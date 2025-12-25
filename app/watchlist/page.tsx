'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAccount } from 'wagmi';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function WatchlistPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'TRADERS'>('LIBRARY');
  const [items, setItems] = useState<any[]>([]);
  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Menu State
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (address) fetchData();
    else setLoading(false);
  }, [address, activeTab]);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  async function fetchData() {
    setLoading(true);

    if (activeTab === 'LIBRARY') {
      const { data: allLists } = await supabase
        .from('watchlists')
        .select('*, watchlist_items(market_id)')
        .ilike('user_wallet', address!)
        .order('created_at', { ascending: false });

      if (!allLists) { setItems([]); setLoading(false); return; }

      const allMarketIds = allLists.flatMap(w => w.watchlist_items.map((i:any) => i.market_id));
      const { data: marketMap } = await supabase.from('markets').select('*').in('id', allMarketIds);
      
      const displayItems: any[] = [];

      allLists.forEach(list => {
        const listMarketIds = list.watchlist_items.map((i:any) => i.market_id);
        const listMarkets = marketMap?.filter(m => listMarketIds.includes(m.id)) || [];

        if (list.name === 'My Watchlist') {
          // SCENARIO A: Single Markets
          listMarkets.forEach((m: any) => {
             displayItems.push({
               type: 'SINGLE_MARKET',
               data: m,
               watchlistId: list.id,
               id: m.id // Use market ID for menu key
             });
          });
        } else {
          // SCENARIO B: Bundles
          if (listMarkets.length > 0) {
            displayItems.push({
              type: 'BUNDLE',
              id: list.id,
              name: list.name,
              count: listMarkets.length,
              image: listMarkets[0]?.image_url,
              createdAt: new Date(list.created_at).toLocaleDateString()
            });
          }
        }
      });
      setItems(displayItems);
    } 
    else {
      // Traders Fetch
      const { data: follows } = await supabase.from('follows').select('following_address').ilike('follower_address', address!);
      if (follows && follows.length > 0) {
        const addresses = follows.map(f => f.following_address);
        const { data: users } = await supabase.from('users').select('*').in('wallet_address', addresses);
        setTraders(users || []);
      }
    }
    setLoading(false);
  }

  // --- ACTIONS ---
  const handleDeleteBundle = async (e: React.MouseEvent, bundleId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this bundle?")) return;
    setItems(prev => prev.filter(i => i.id !== bundleId));
    await supabase.from('watchlist_items').delete().eq('watchlist_id', bundleId);
    await supabase.from('watchlists').delete().eq('id', bundleId);
  };

  const handleRemoveSingle = async (e: React.MouseEvent, marketId: string, watchlistId: string) => {
    e.stopPropagation();
    if (!confirm("Remove from watchlist?")) return;
    setItems(prev => prev.filter(i => !(i.type === 'SINGLE_MARKET' && i.data.id === marketId)));
    await supabase.from('watchlist_items').delete().eq('watchlist_id', watchlistId).eq('market_id', marketId);
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleShare = (e: React.MouseEvent, id: string, type: 'BUNDLE' | 'SINGLE') => {
    e.stopPropagation();
    const path = type === 'BUNDLE' ? `/workspace?id=${id}` : `/market?id=${id}`;
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    alert("🔗 Copied Link!");
    setOpenMenuId(null);
  };

  if (!isConnected) return <div className="container center-msg"><ConnectWallet /></div>;

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      
      <div className="watchlist-header">
         <h1 className="section-title">Your Library</h1>
      </div>

      <div className="tabs-row">
        <button className={`tab-btn ${activeTab === 'LIBRARY' ? 'active' : ''}`} onClick={() => setActiveTab('LIBRARY')}>Library</button>
        <button className={`tab-btn ${activeTab === 'TRADERS' ? 'active' : ''}`} onClick={() => setActiveTab('TRADERS')}>Following</button>
      </div>

      {loading ? <div className="loading">Loading...</div> : 
       activeTab === 'LIBRARY' ? (
         items.length === 0 ? (
           <div className="empty-state">Nothing saved yet.</div>
         ) : (
           <div className="library-stack">
             {items.map((item, idx) => {
               
               // --- RENDER 1: BUNDLE FOLDER ---
               if (item.type === 'BUNDLE') {
                 return (
                   <div key={item.id} className="bundle-card-wrapper" onClick={() => router.push(`/workspace?id=${item.id}`)}>
                      <div className="b-icon BUNDLE"><span className="folder-emoji">📁</span></div>
                      <div className="b-info">
                         <div className="b-name">{item.name}</div>
                         <div className="b-meta">{item.count} Markets • {item.createdAt}</div>
                      </div>
                      
                      {/* MENU */}
                      <div className="menu-container">
                        <button className="dots-btn" onClick={(e) => toggleMenu(e, item.id)}>⋮</button>
                        {openMenuId === item.id && (
                          <div className="dropdown-menu">
                            <button onClick={(e) => handleShare(e, item.id, 'BUNDLE')}>🔗 Share</button>
                            <button className="danger" onClick={(e) => handleDeleteBundle(e, item.id)}>🗑 Delete</button>
                          </div>
                        )}
                      </div>
                   </div>
                 );
               } 
               
               // --- RENDER 2: SINGLE MARKET (Clean Row) ---
               else {
                 const m = item.data;
                 const yesPrice = m.best_ask_yes ?? m.current_yes_price;
                 const noPrice = m.best_ask_no ?? (m.current_yes_price ? 1 - m.current_yes_price : 0);

                 return (
                   <div 
                     key={m.id + idx} 
                     className="market-card-row watchlist-item"
                     onClick={() => router.push(`/market?id=${m.id}`)}
                   >
                      {/* ICON & TITLE */}
                      <div className="content-area">
                        <div className="icon-wrapper">
                          <img 
                            src={m.image_url || '/placeholder.png'} 
                            className="market-icon" 
                            onError={e => {e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden')}}
                          />
                          <div className="market-icon-placeholder hidden">K</div>
                        </div>

                        <div className="text-info">
                          <h3 className="market-title">{m.title}</h3>
                          <div className="meta-tags">
                             <span className={`platform-badge ${m.platform.toLowerCase()}`}>{m.platform}</span>
                             <span className="vol-badge">${Number(m.volume_usd).toLocaleString()} Vol</span>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT SIDE: PRICES + MENU */}
                      <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                         {/* Prices */}
                         <div className="dual-price-area">
                            <div className="price-box yes">YES ${yesPrice?.toFixed(2) || '-'}</div>
                            <div className="price-box no">NO ${noPrice?.toFixed(2) || '-'}</div>
                         </div>

                         {/* MENU */}
                         <div className="menu-container">
                            <button className="dots-btn" onClick={(e) => toggleMenu(e, m.id)}>⋮</button>
                            {openMenuId === m.id && (
                              <div className="dropdown-menu">
                                <button onClick={(e) => handleShare(e, m.id, 'SINGLE')}>🔗 Share</button>
                                <button className="danger" onClick={(e) => handleRemoveSingle(e, m.id, item.watchlistId)}>🗑 Remove</button>
                              </div>
                            )}
                         </div>
                      </div>
                   </div>
                 );
               }
             })}
           </div>
         )
       ) : (
         /* TRADERS TAB */
         <div className="trader-grid">
            {traders.map(t => (
              <div key={t.wallet_address} className="trader-card">
                 <div className="t-name">{t.username || t.wallet_address.slice(0,6)}</div>
              </div>
            ))}
         </div>
       )
      }
    </div>
  );
}
