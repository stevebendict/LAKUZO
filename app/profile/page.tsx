'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation'; // CHANGED
import { createClient } from '@supabase/supabase-js';
import { useAccount } from 'wagmi';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function ProfileContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug'); // CHANGED: Get slug from ?slug=...
  
  const { address: myAddress } = useAccount();
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (slug) fetchPublicProfile();
  }, [slug, myAddress]);

  async function fetchPublicProfile() {
    setLoading(true);
    let userQuery = supabase.from('users').select('*');
    
    const term = String(slug);
    if (term.startsWith('0x')) {
      userQuery = userQuery.eq('wallet_address', term);
    } else {
      const cleanName = term.replace('%40', '').replace('@', ''); 
      userQuery = userQuery.eq('username', cleanName);
    }

    const { data: user } = await userQuery.maybeSingle();

    if (!user) { setLoading(false); return; }
    setProfile(user);

    const { data: votes } = await supabase.from('votes').select(`choice, created_at, markets (title)`).eq('wallet_address', user.wallet_address).order('created_at', { ascending: false });
    setHistory(votes || []);

    if (myAddress) {
      const { data: follow } = await supabase.from('follows').select('*').eq('follower_address', myAddress).eq('following_address', user.wallet_address).maybeSingle();
      if (follow) setIsFollowing(true);
    }
    setLoading(false);
  }

  const handleFollowToggle = async () => {
    if (!myAddress) return alert("Connect wallet to follow.");
    setIsFollowing(!isFollowing);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_address', myAddress).eq('following_address', profile.wallet_address);
    } else {
      await supabase.from('follows').insert({ follower_address: myAddress, following_address: profile.wallet_address });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("🔗 Profile Link Copied!");
  };

  if (loading) return <div className="loading">Searching Database...</div>;
  if (!profile) return <div className="container center-msg">User not found</div>;

  const isMe = myAddress && profile.wallet_address.toLowerCase() === myAddress.toLowerCase();

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      <div className="profile-header-clean">
         <div className="ph-left">
            <h1 className="ph-name">{profile.username ? `@${profile.username}` : 'Anonymous Trader'}</h1>
            <div className="ph-meta">
               <span className="ph-addr">{profile.wallet_address.substring(0,6)}...{profile.wallet_address.slice(-4)}</span>
               <span className="ph-rep-tag">{profile.reputation_score} REP</span>
            </div>
         </div>
         <div className="ph-right">
             {!isMe && (
               <button onClick={handleFollowToggle} className={`control-btn ${isFollowing ? 'logout' : 'edit'}`} style={{minWidth: '90px'}}>
                 {isFollowing ? 'Unfollow' : 'Follow'}
               </button>
             )}
             <button onClick={handleShare} className="icon-btn-share" title="Share">🔗</button>
         </div>
      </div>
      <div className="stats-row-simple" style={{marginTop:'20px'}}>
         <div className="stat-box"><span className="val">{history.length}</span><span className="lbl">Votes Cast</span></div>
         <div className="stat-box"><span className="val">--</span><span className="lbl">Win Rate</span></div>
      </div>
      <h3 className="section-title" style={{marginTop:'30px'}}>Recent Activity</h3>
      <div className="history-list">
        {history.length === 0 ? <div className="empty-text">No public activity.</div> : (
          history.map((vote: any, i) => (
            <div key={i} className="history-item">
               <div className="h-left"><div className="h-title">{vote.markets?.title || 'Unknown Market'}</div><div className="h-date">{new Date(vote.created_at).toLocaleDateString()}</div></div>
               <div className="h-right"><span className={`vote-tag ${vote.choice === 'YES' ? 'yes' : 'no'}`}>VOTED {vote.choice}</span></div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="loading">Loading Profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
