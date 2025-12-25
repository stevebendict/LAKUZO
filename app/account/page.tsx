'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AccountPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (address) fetchAccountData();
    else setLoading(false);
  }, [address]);

  async function fetchAccountData() {
    // 1. Fetch User Stats
    let { data: user } = await supabase.from('users').select('*').eq('wallet_address', address).maybeSingle();
    
    if (!user) {
       // Auto-create if missing
       const { data: newUser } = await supabase
         .from('users')
         .insert({ wallet_address: address, reputation_score: 100 })
         .select()
         .single();
       user = newUser;
    }
    setProfile(user);
    setNewUsername(user?.username || '');

    // 2. Fetch Vote History
    const { data: votes } = await supabase
      .from('votes')
      .select(`choice, weight_at_time, created_at, markets (title, id)`)
      .eq('wallet_address', address)
      .order('created_at', { ascending: false });

    setHistory(votes || []);
    setLoading(false);
  }

  // --- ACTIONS ---
  const handleSaveProfile = async () => {
    if (!newUsername.trim()) return alert("Username cannot be empty");
    setIsSaving(true);
    
    // Check if username is taken (if changed)
    if (newUsername !== profile.username) {
      const { data: existing } = await supabase.from('users').select('wallet_address').eq('username', newUsername).maybeSingle();
      if (existing) {
        setIsSaving(false);
        return alert("Username already taken!");
      }
    }

    const { error } = await supabase
      .from('users')
      .update({ username: newUsername })
      .eq('wallet_address', address);

    if (error) {
      alert("Error saving profile");
    } else {
      setProfile({ ...profile, username: newUsername });
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleShare = () => {
    // Smart Link: Use username if set, else address
    const slug = profile.username || profile.wallet_address;
    const url = `${window.location.origin}/profile?slug=${slug}`;
    navigator.clipboard.writeText(url);
    alert("🔗 Profile Link Copied: " + url);
  };

  const handleLogout = () => {
    disconnect();
    window.location.href = '/'; // Hard redirect to clear state
  };

  if (!isConnected) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>
        <h3>Connect to view Profile</h3>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}><ConnectWallet /></div>
      </div>
    );
  }

  if (loading || !profile) return <div className="loading">Loading Profile...</div>;

 return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      
      {/* CLEAN PROFILE HEADER */}
      <div className="profile-header-clean">
         <div className="ph-left">
            {isEditing ? (
              <div className="edit-username-box">
                <span className="at-symbol">@</span>
                <input 
                  type="text" 
                  value={newUsername} 
                  onChange={e => setNewUsername(e.target.value.replace(/\s+/g, '').toLowerCase())} 
                  className="username-input"
                  placeholder="username"
                  autoFocus
                />
              </div>
            ) : (
              <h1 className="ph-name">
                {profile.username ? `@${profile.username}` : 'Anonymous'}
              </h1>
            )}
            
            <div className="ph-meta">
               <span className="ph-addr">{address?.substring(0, 6)}...{address?.slice(-4)}</span>
               <span className="ph-rep-tag">{profile.reputation_score} REP</span>
            </div>
         </div>

         {/* CONTROLS */}
         <div className="ph-right">
             {isEditing ? (
               <div className="edit-actions">
                 <button onClick={() => setIsEditing(false)} className="btn-cancel-small">Cancel</button>
                 <button onClick={handleSaveProfile} disabled={isSaving} className="btn-save-small">Save</button>
               </div>
             ) : (
               <button onClick={() => setIsEditing(true)} className="icon-btn-edit" title="Edit Profile">✎</button>
             )}
             <button onClick={handleShare} className="icon-btn-share" title="Share">🔗</button>
             <button onClick={handleLogout} className="icon-btn-logout" title="Logout">⏻</button>
         </div>
      </div>

      {/* STATS ROW (Same as before) */}
      <div className="stats-row-simple" style={{marginTop:'20px'}}>
         <div className="stat-box">
            <span className="val">{history.length}</span>
            <span className="lbl">Votes Cast</span>
         </div>
         <div className="stat-box">
            <span className="val">--</span>
            <span className="lbl">Win Rate</span>
         </div>
      </div>

      {/* HISTORY (Same as before) */}
      <h3 className="section-title" style={{marginTop:'30px'}}>Prediction History</h3>
      <div className="history-list">
        {history.length === 0 ? <div className="empty-text">No votes yet.</div> : (
          history.map((vote: any, i) => (
            <div key={i} className="history-item">
               <div className="h-left">
                  <div className="h-title">{vote.markets?.title || 'Unknown'}</div>
                  <div className="h-date">{new Date(vote.created_at).toLocaleDateString()}</div>
               </div>
               <div className="h-right">
                  <span className={`vote-tag ${vote.choice === 'YES' ? 'yes' : 'no'}`}>VOTED {vote.choice}</span>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
