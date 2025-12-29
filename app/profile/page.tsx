'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BASESCAN_URL = "https://sepolia.basescan.org/tx"; 

function ProfileContent() {
  const searchParams = useSearchParams();
  const targetAddress = searchParams.get('address'); 
  const router = useRouter();
  
  const { address: myAddress } = useAccount(); // The Visitor
  
  // --- STATE ---
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ followers: 0, following: 0, reputation: 100, totalVotes: 0 });
  const [activeTab, setActiveTab] = useState<'WORKSPACES' | 'HISTORY'>('WORKSPACES');
  const [items, setItems] = useState<any[]>([]); // Data for the active tab
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  // 1. INITIAL FETCH
  useEffect(() => {
    if (targetAddress) {
        fetchPublicProfile();
    }
  }, [targetAddress, myAddress]); // Re-run if my wallet connects/disconnects

  // 2. TAB SWITCHER
  useEffect(() => {
    if (profile) fetchTabContent();
  }, [activeTab, profile]);

  async function fetchPublicProfile() {
    setLoading(true);
    
    // A. GET USER DETAILS
    const { data: user } = await supabase.from('users').select('*').eq('wallet_address', targetAddress).maybeSingle();
    const displayUser = user || { username: 'Anon', wallet_address: targetAddress, reputation_score: 100, total_votes: 0 };
    setProfile(displayUser);

    // B. GET SOCIAL STATS
    const { count: followers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_address', targetAddress);
    const { count: following } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_address', targetAddress);
    
    setStats({ 
       followers: followers || 0, 
       following: following || 0, 
       reputation: displayUser.reputation_score,
       totalVotes: displayUser.total_votes || 0
    });
    // C. CHECK IF I AM FOLLOWING THEM
    if (myAddress && targetAddress) {
      const { data: follow } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_address', myAddress)
        .eq('following_address', targetAddress)
        .maybeSingle();
      
      setIsFollowing(!!follow);
    }

    setLoading(false);
  }

  async function fetchTabContent() {
    if (!targetAddress) return;
    
    // TAB 1: PUBLIC WORKSPACES (The Curated Content)
    if (activeTab === 'WORKSPACES') {
        // Fetch workspaces EXCLUDING "My Watchlist" (Private default)
        const { data: ws } = await supabase
           .from('watchlists')
           .select('*')
           .eq('user_wallet', targetAddress)
           .neq('name', 'My Watchlist') 
           .order('created_at', { ascending: false });

        if (ws && ws.length > 0) {
            // Fetch previews manually (Robust Method)
            const wsIds = ws.map(w => w.id);
            const { data: wItems } = await supabase.from('watchlist_items').select('watchlist_id, market_id').in('watchlist_id', wsIds);
            
            if (wItems && wItems.length > 0) {
                const marketIds = wItems.map((i: any) => i.market_id);
                const { data: markets } = await supabase.from('markets').select('id, image_url').in('id', marketIds);
                
                const richData = ws.map(w => {
                    const myItemIds = wItems.filter((i: any) => i.watchlist_id === w.id).map((i: any) => i.market_id);
                    const images = markets?.filter((m: any) => myItemIds.includes(m.id)).map((m: any) => m.image_url).filter(Boolean).slice(0, 4) || [];
                    return { ...w, previewImages: images, count: images.length };
                });
                setItems(richData);
            } else {
                setItems(ws.map(w => ({ ...w, previewImages: [], count: 0 })));
            }
        } else {
            setItems([]);
        }
    }

    // TAB 2: VOTE HISTORY (The "Skin in the Game" Proof)
    else if (activeTab === 'HISTORY') {
        const { data: votes } = await supabase
           .from('votes')
           .select('*, markets(title)')
           .eq('wallet_address', targetAddress)
           .order('created_at', { ascending: false });
        
        setItems(votes || []);
    }
  }

  // --- ACTIONS ---

  const handleFollowToggle = async () => {
    if (!myAddress) return alert("Please connect your wallet to follow.");
    if (!targetAddress) return;

    // Optimistic Update
    setIsFollowing(!isFollowing);
    setStats(prev => ({ 
        ...prev, 
        followers: isFollowing ? prev.followers - 1 : prev.followers + 1 
    }));

    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_address', myAddress).eq('following_address', targetAddress);
    } else {
      await supabase.from('follows').insert({ follower_address: myAddress, following_address: targetAddress });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("🔗 Profile Link Copied!");
  };

  if (loading && !profile) return <div className="loading-wrapper"><div className="spinner"></div></div>;
  if (!targetAddress) return <div className="empty-box">User not found</div>;

  const isMe = myAddress && targetAddress.toLowerCase() === myAddress.toLowerCase();

  return (
    <div className="mobile-container-dark" style={{ paddingBottom: '120px' }}>
      
      {/* PUBLIC HEADER */}
      <div className="profile-header">
         <div className="profile-top">
            <div className="profile-avatar-lg">
               {(profile?.username?.[0])?.toUpperCase() || '👤'}
            </div>
            <div className="profile-stats-group">
               <div className="stat-item">
                  <span className="stat-num">{stats.reputation}</span>
                  <span className="stat-label">Rep</span>
               </div>
               <div className="stat-item">
                  <span className="stat-num">{stats.totalVotes}</span>
                  <span className="stat-label">Votes</span>
               </div>
               {/* STATIC STATS (Not Clickable for Visitors) */}
               <div className="stat-item">
                  <span className="stat-num">{stats.followers}</span>
                  <span className="stat-label">Followers</span>
               </div>
               <div className="stat-item">
                  <span className="stat-num">{stats.following}</span>
                  <span className="stat-label">Following</span>
               </div>
            </div>
         </div>
         
         <div className="profile-bio">
            <h1 className="real-name">{profile?.username || 'Anonymous Trader'}</h1>
            <p className="wallet-tag">{targetAddress.slice(0,6)}...{targetAddress.slice(-4)}</p>
         </div>

         <div className="profile-actions">
            {!isMe && (
                <button 
                  onClick={handleFollowToggle} 
                  className={isFollowing ? "btn-edit-profile" : "btn-primary-full"}
                  style={isFollowing ? {} : { marginTop: 0 }} // Remove margin if using primary style
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
            )}
            <button className="btn-share-profile" onClick={handleShare}>Share Profile</button>
         </div>
      </div>

      {/* TABS (No Search Bar - Keep it Clean) */}
      <div className="sticky-control-bar">
         <div className="ios-segment-wrapper">
            <div className="ios-segment">
                <button className={`seg-btn ${activeTab === 'WORKSPACES' ? 'active' : ''}`} onClick={() => setActiveTab('WORKSPACES')}>Bundles</button>
                <button className={`seg-btn ${activeTab === 'HISTORY' ? 'active' : ''}`} onClick={() => setActiveTab('HISTORY')}>History</button>
            </div>
         </div>
      </div>

      <div className="dash-content fade-in">
         {items.length === 0 ? (
            <div className="empty-box">No public activity yet.</div>
         ) : (
             <>
                {/* PUBLIC BUNDLES */}
                {activeTab === 'WORKSPACES' && (
                    <div className="workspace-grid-container">
                        {items.map((w, i) => (
                            <div key={`${w.id}-${i}`} className="ws-folder-card" onClick={() => router.push(`/workspace?id=${w.id}`)}>
                                <div className="folder-mini-grid">
                                    {w.previewImages && w.previewImages.slice(0,4).map((img:string, idx:number) => (
                                        <img key={idx} src={img} className="mini-grid-img" onError={(e)=>e.currentTarget.style.display='none'} />
                                    ))}
                                    {(!w.previewImages || w.previewImages.length === 0) && <div className="empty-folder-icon">📁</div>}
                                </div>
                                <div className="folder-info-bottom">
                                    <div className="folder-title-sm">{w.name}</div>
                                    <div className="folder-count">{w.count || 0} items</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* PUBLIC HISTORY */}
                {activeTab === 'HISTORY' && items.map((vote, i) => (
                    <div key={`${vote.id}-${i}`} className="history-row">
                        <div className="h-icon-col">
                            <div className={`vote-badge ${vote.choice === 'YES' ? 'yes' : 'no'}`}>{vote.choice}</div>
                            <div className="connector-line"></div>
                        </div>
                        <div className="h-content">
                            <div className="h-title">{vote.markets?.title || 'Unknown Market'}</div>
                            <div className="h-meta">
                                <span>{new Date(vote.created_at).toLocaleDateString()}</span>
                                <a href={`${BASESCAN_URL}/${vote.tx_hash}`} target="_blank" className="basescan-link">Verify ↗</a>
                            </div>
                        </div>
                    </div>
                ))}
             </>
         )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="loading-wrapper">Loading Profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
