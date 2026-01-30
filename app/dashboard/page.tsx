'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { useRouter } from 'next/navigation';
import debounce from 'lodash/debounce';


const BASESCAN_URL = "https://basescan.org/tx"; 
const ITEMS_PER_PAGE = 10;

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'MAIN' | 'FOLLOWING_LIST' | 'FOLLOWERS_LIST' | 'EDIT_PROFILE'>('MAIN');
  const [activeTab, setActiveTab] = useState<'HISTORY' | 'MARKETS' | 'WORKSPACES'>('HISTORY');
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ followers: 0, following: 0, reputation: 100, totalVotes: 0 }); 
  const [items, setItems] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (address) {
      loadProfileHeader();
      resetAndFetch(0, '');
    }
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [address]);

  useEffect(() => {
    setOpenMenuId(null); 
    resetAndFetch(0, search);
  }, [activeTab, viewMode]);

  const resetAndFetch = (pageIdx: number, q: string) => {
    setItems([]); 
    setPage(pageIdx);
    setHasMore(true);
    fetchTabItems(pageIdx, true, q);
  };

  const handleSearch = (e: any) => {
    const val = e.target.value;
    setSearch(val);
    debouncedFetch(val);
  };
  
  const debouncedFetch = useCallback(
    debounce((query: string) => {
      resetAndFetch(0, query);
    }, 500),
    [activeTab, viewMode]
  );

  async function loadProfileHeader() {
    const { data: user } = await supabase.from('users').select('*').eq('wallet_address', address).single();
    setProfile(user || { username: 'Anon', wallet_address: address });
    setEditName(user?.username || '');

    const { count: followers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_address', address);
    const { count: following } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_address', address);
    
    setStats({ 
       followers: followers || 0, 
       following: following || 0, 
       reputation: user?.reputation_score || 100,
       totalVotes: user?.total_votes || 0 
    });
  }

  async function fetchTabItems(pageIndex: number, isFresh: boolean, searchQuery: string) {
    if (!address) return;
    setLoading(true);

    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    let data: any[] = [];

    try {
      if (viewMode === 'FOLLOWING_LIST') {
         const { data: raw } = await supabase.from('follows').select('following_address').eq('follower_address', address).range(from, to);
         if (raw?.length) {
            const addrs = raw.map(r => r.following_address);
            let q = supabase.from('users').select('*').in('wallet_address', addrs);
            if (searchQuery) q = q.ilike('username', `%${searchQuery}%`);
            const { data: users } = await q;
            data = users || [];
         }
      } 
      else if (viewMode === 'FOLLOWERS_LIST') {
         const { data: raw } = await supabase.from('follows').select('follower_address').eq('following_address', address).range(from, to);
         if (raw?.length) {
            const addrs = raw.map(r => r.follower_address);
            let q = supabase.from('users').select('*').in('wallet_address', addrs);
            if (searchQuery) q = q.ilike('username', `%${searchQuery}%`);
            const { data: users } = await q;
            data = users || [];
         }
      }

      else if (activeTab === 'HISTORY') {
         let query = supabase.from('votes').select('*, markets!inner(title, image_url)').eq('wallet_address', address).order('created_at', { ascending: false }).range(from, to);
         if (searchQuery) query = query.ilike('markets.title', `%${searchQuery}%`);
         const { data: res } = await query;
         data = res || [];
      }
      
      else if (activeTab === 'MARKETS') {
         const { data: items } = await supabase.from('watchlist_items').select('market_id, watchlists!inner(user_wallet)').eq('watchlists.user_wallet', address).range(from, to);
         if (items?.length) {
           const ids = items.map((i:any) => i.market_id);
           let mQuery = supabase.from('markets').select('*').in('id', ids);
           if (searchQuery) mQuery = mQuery.ilike('title', `%${searchQuery}%`);
           const { data: markets } = await mQuery;
           data = markets || [];
         }
      }

      else if (activeTab === 'WORKSPACES') {
         let query = supabase
           .from('watchlists')
           .select('*')
           .eq('user_wallet', address)
           .neq('name', 'My Watchlist')
           .order('created_at', { ascending: false })
           .range(from, to);
         
         if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
         
         const { data: ws } = await query;
         
         if (ws && ws.length > 0) {
            const wsIds = ws.map(w => w.id);
            const { data: wItems } = await supabase.from('watchlist_items').select('watchlist_id, market_id').in('watchlist_id', wsIds);

            if (wItems && wItems.length > 0) {
                const marketIds = wItems.map((i: any) => i.market_id);
                const { data: markets } = await supabase.from('markets').select('id, image_url').in('id', marketIds);
                
                data = ws.map(w => {
                    const myItemIds = wItems.filter((i: any) => i.watchlist_id === w.id).map((i: any) => i.market_id);
                    const images = markets?.filter((m: any) => myItemIds.includes(m.id)).map((m: any) => m.image_url).filter(Boolean).slice(0, 4) || [];
                    return { ...w, previewImages: images, count: images.length };
                });
            } else {
                data = ws.map(w => ({ ...w, previewImages: [], count: 0 }));
            }
         }
      }
    } catch (e) { console.error("Fetch Error:", e); }

    if (data.length < ITEMS_PER_PAGE) setHasMore(false);
    
    if (isFresh) setItems(data);
    else setItems(prev => {
        const newItems = data.filter(d => !prev.some(p => p.id === d.id)); 
        return [...prev, ...newItems];
    });
    setLoading(false);
  }

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchTabItems(next, false, search);
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleUnfollow = async (targetAddress: string) => {
    if (!confirm("Unfollow this user?")) return;
    await supabase.from('follows').delete().eq('follower_address', address).eq('following_address', targetAddress);
    setItems(prev => prev.filter(u => u.wallet_address !== targetAddress));
    setStats(prev => ({ ...prev, following: Math.max(0, prev.following - 1) }));
  };

  const handleRemoveMarket = async (marketId: string) => {
    const { data: wl } = await supabase.from('watchlists').select('id').eq('user_wallet', address).eq('name', 'My Watchlist').single();
    if (wl) {
        await supabase.from('watchlist_items').delete().eq('watchlist_id', wl.id).eq('market_id', marketId);
        setItems(prev => prev.filter(m => m.id !== marketId)); 
    }
  };

  const handleDeleteBundle = async (bundleId: string) => {
    if (!confirm("Delete this workspace?")) return;
    await supabase.from('watchlist_items').delete().eq('watchlist_id', bundleId);
    await supabase.from('watchlists').delete().eq('id', bundleId);
    setItems(prev => prev.filter(w => w.id !== bundleId));
  };

  const handleShareProfile = () => {
    const url = `${window.location.origin}/profile?address=${address}`;
    navigator.clipboard.writeText(url);
    alert("🔗 Profile Link Copied!");
  };

  const handleShareItem = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    alert("🔗 Link Copied!");
    setOpenMenuId(null);
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    const { data: existing } = await supabase.from('users').select('wallet_address').ilike('username', editName).single();
    if (existing && existing.wallet_address !== address) { alert("Username taken."); setSaving(false); return; }
    const { error } = await supabase.from('users').upsert({ wallet_address: address, username: editName }, { onConflict: 'wallet_address' });
    if (!error) { setProfile((p:any) => ({ ...p, username: editName })); setViewMode('MAIN'); }
    setSaving(false);
  };

  const handleLogout = () => { disconnect(); router.push('/'); };

  if (!isConnected) {
    return (
      <div className="wallet-gate-overlay" style={{ position: 'fixed', zIndex: 10 }}>
        <div className="wallet-gate-card">
          <div className="gate-icon">📊</div>
          <div>
            <h3 className="gate-title">Unlock Your Dashboard</h3>
            <p className="gate-desc">
              Connect to track your portfolio, view history, and analyze your performance.
            </p>
          </div>
          <ConnectWallet className="cb-wallet-custom" />
        </div>
      </div>
    );
  }

  if (viewMode === 'EDIT_PROFILE') return (
      <div className="mobile-container-dark">
         <div className="sticky-header-dark" style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <button onClick={() => setViewMode('MAIN')} className="icon-btn-circle">←</button>
            <h2 className="section-title" style={{margin:0}}>Edit Profile</h2>
         </div>
         <div className="edit-form-wrapper">
             <div className="avatar-edit-preview">{profile?.username?.[0] || '👤'}</div>
             <div className="form-group"><label>Username</label><input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="dark-input" /></div>
             <div className="form-group"><label>Wallet</label><div className="readonly-field">{address}</div></div>
             <button onClick={handleUpdateProfile} disabled={saving} className="btn-primary-full">{saving ? 'Saving...' : 'Save Changes'}</button>
             <div className="divider-row"></div>
             <button onClick={handleLogout} className="btn-danger-outline">Log Out</button>
         </div>
      </div>
  );

  if (viewMode === 'FOLLOWING_LIST' || viewMode === 'FOLLOWERS_LIST') return (
      <div className="mobile-container-dark">
         <div className="sticky-header-dark" style={{ display:'flex', flexDirection:'column', gap:'12px', alignItems:'flex-start' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%' }}>
              <button onClick={() => setViewMode('MAIN')} className="icon-btn-circle">←</button>
              <h2 className="section-title" style={{margin:0}}>{viewMode === 'FOLLOWING_LIST' ? 'Following' : 'Followers'}</h2>
            </div>
            <div className="ios-search-container"><span className="search-icon">🔍</span><input type="text" placeholder="Search" onChange={handleSearch} className="ios-search-input"/></div>
         </div>
         <div className="people-list">
            {items.map((u, i) => (
               <div 
                 key={`${u.wallet_address}-${i}`} 
                 className="person-card"
                 onClick={() => router.push(`/profile?address=${u.wallet_address}`)}
               >
                  <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1}}>
                    <div className="person-avatar">{(u.username?.[0])?.toUpperCase() || '👤'}</div>
                    <div className="person-info"><div className="person-name">{u.username || 'Anon'}</div></div>
                  </div>
                  {viewMode === 'FOLLOWING_LIST' && (
                     <button onClick={(e) => { e.stopPropagation(); handleUnfollow(u.wallet_address); }} className="btn-small-outline">Unfollow</button>
                  )}
               </div>
            ))}
            {hasMore && <button onClick={loadMore} className="load-more-btn">Load More</button>}
         </div>
      </div>
  );

  return (
    <div className="mobile-container-dark" style={{ paddingBottom: '120px' }}>
      <div className="profile-header">
         <div className="profile-top">
            <div className="profile-avatar-lg">{(profile?.username?.[0])?.toUpperCase() || '👤'}</div>
            <div className="profile-stats-group">
               <div className="stat-item">
                  <span className="stat-num">{stats.reputation}</span>
                  <span className="stat-label">Rep</span>
               </div>
               <div className="stat-item">
                  <span className="stat-num">{stats.totalVotes}</span>
                  <span className="stat-label">Votes</span>
               </div>
               <div className="stat-item clickable" onClick={() => setViewMode('FOLLOWERS_LIST')}>
                  <span className="stat-num">{stats.followers}</span>
                  <span className="stat-label">Followers</span>
               </div>
               <div className="stat-item clickable" onClick={() => setViewMode('FOLLOWING_LIST')}>
                  <span className="stat-num">{stats.following}</span>
                  <span className="stat-label">Following</span>
               </div>
            </div>
</div>
         <div className="profile-bio"><h1 className="real-name">{profile?.username || 'Anonymous Trader'}</h1><p className="wallet-tag">{address?.slice(0,6)}...{address?.slice(-4)}</p></div>
         <div className="profile-actions">
            <button className="btn-edit-profile" onClick={() => setViewMode('EDIT_PROFILE')}>Edit Profile</button>
            <button className="btn-share-profile" onClick={handleShareProfile}>Share</button>
         </div>
      </div>

      <div className="sticky-control-bar">
         <div className="ios-segment-wrapper">
            <div className="ios-segment">
                <button className={`seg-btn ${activeTab === 'HISTORY' ? 'active' : ''}`} onClick={() => setActiveTab('HISTORY')}>History</button>
                <button className={`seg-btn ${activeTab === 'MARKETS' ? 'active' : ''}`} onClick={() => setActiveTab('MARKETS')}>Saved</button>
                <button className={`seg-btn ${activeTab === 'WORKSPACES' ? 'active' : ''}`} onClick={() => setActiveTab('WORKSPACES')}>Bundles</button>
            </div>
         </div>
         <div style={{ padding: '0 16px 12px' }}>
             <div className="ios-search-container"><span className="search-icon">🔍</span><input type="text" placeholder={`Search ${activeTab.toLowerCase()}`} onChange={handleSearch} className="ios-search-input"/></div>
         </div>
      </div>

      <div className="dash-content fade-in">
         {loading && items.length === 0 ? <div className="loading-spinner-dark">Loading...</div> : items.length === 0 ? <div className="empty-box">Nothing found.</div> : (
             <>
                {activeTab === 'HISTORY' && items.map((vote, i) => (
                    <div key={`${vote.id}-${i}`} className="history-row">
                        <div className="h-icon-col"><div className={`vote-badge ${vote.choice === 'YES' ? 'yes' : 'no'}`}>{vote.choice}</div><div className="connector-line"></div></div>
                        <div className="h-content">
                            <div className="h-title">{vote.markets?.title}</div>
                            <div className="h-meta"><span>{new Date(vote.created_at).toLocaleDateString()}</span><a href={`${BASESCAN_URL}/${vote.tx_hash}`} target="_blank" className="basescan-link">View on BaseScan ↗</a></div>
                        </div>
                    </div>
                ))}

                {activeTab === 'MARKETS' && items.map((m, i) => (
                    <div key={`${m.id}-${i}`} className="lib-market-row" onClick={() => router.push(`/market?id=${m.id}`)}>
                        <img src={m.image_url} className="row-img" onError={(e) => e.currentTarget.style.display='none'} />
                        <div className="row-info"><div className="row-title">{m.title}</div><div className="row-meta">${(m.volume_usd/1000).toFixed(0)}k Vol</div></div>
                        <button className="row-dots-btn" onClick={(e) => toggleMenu(e, m.id)}>•••</button>
                        {openMenuId === m.id && (
                           <div className="floating-menu" onClick={e => e.stopPropagation()}>
                              <button onClick={() => handleShareItem(`/market?id=${m.id}`)}>Share</button>
                              <button className="destructive" onClick={() => handleRemoveMarket(m.id)}>Remove</button>
                           </div>
                        )}
                    </div>
                ))}

                {activeTab === 'WORKSPACES' && (
                    <div className="workspace-grid-container">
                        <div className="ws-folder-card create-new" onClick={() => router.push('/')}>
                            <div className="plus-icon-circle">+</div>
                            <span className="create-text">New Bundle</span>
                        </div>
                        {items.map((w, i) => (
                            <div key={`${w.id}-${i}`} className="ws-folder-card" onClick={() => router.push(`/workspace?id=${w.id}`)}>
                                <button className="ws-dots-btn" onClick={(e) => toggleMenu(e, w.id)}>•••</button>
                                {openMenuId === w.id && (
                                   <div className="floating-menu" style={{top: '40px', right: '10px'}} onClick={e => e.stopPropagation()}>
                                      <button onClick={() => handleShareItem(`/workspace?id=${w.id}`)}>Share</button>
                                      <button className="destructive" onClick={() => handleDeleteBundle(w.id)}>Delete</button>
                                   </div>
                                )}
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

                {hasMore && <button onClick={loadMore} className="load-more-btn">Load More</button>}
             </>
         )}
      </div>
    </div>
  );
}
