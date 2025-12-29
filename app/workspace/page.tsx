'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useAccount } from 'wagmi';
import CompareChart from '@/components/CompareChart';
import MarketVotingCard from '@/components/MarketVotingCard';
import { getMarketUrl, getOrderBook } from '@/utils/marketUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { address } = useAccount();

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [markets, setMarkets] = useState<any[]>([]);
  
  // Bundle Metadata
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [bundleName, setBundleName] = useState('');
  const [description, setDescription] = useState('');
  const [creator, setCreator] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  // Permissions & Modes
  const [isOwner, setIsOwner] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. INITIAL FETCH
  useEffect(() => {
    const existingBundleId = searchParams.get('id');       
    const selectedIdsParam = searchParams.get('ids'); 

    async function init() {
      let loadedMarkets: any[] = [];

      // A. VIEWING EXISTING BUNDLE
      if (existingBundleId) {
        setBundleId(existingBundleId);
        
        // 1. Get the Watchlist Details (Simple Fetch)
        const { data: wl } = await supabase
          .from('watchlists')
          .select('*')
          .eq('id', existingBundleId)
          .single();

        if (wl) {
          setBundleName(wl.name);
          setDescription(wl.description || '');
          setCreatedAt(new Date(wl.created_at).toLocaleDateString());
          
          // 2. Check Ownership (Case Insensitive!)
          if (address && wl.user_wallet && wl.user_wallet.toLowerCase() === address.toLowerCase()) {
            setIsOwner(true);
          }

          // 3. Get Creator Profile (Manual Fetch)
          if (wl.user_wallet) {
             const { data: user } = await supabase
                .from('users')
                .select('username')
                .eq('wallet_address', wl.user_wallet)
                .maybeSingle();
             setCreator(user?.username || wl.user_wallet.slice(0,6));
          }

          // 4. Get the Items (Manual Join)
          const { data: items } = await supabase
             .from('watchlist_items')
             .select('market_id')
             .eq('watchlist_id', existingBundleId);

          if (items && items.length > 0) {
            const marketIds = items.map((i: any) => i.market_id);
            // 5. Get the Markets
            const { data: mData } = await supabase.from('markets').select('*').in('id', marketIds);
            loadedMarkets = mData || [];
          }
        }
      } 
      // B. CREATING NEW (Draft Mode)
      else if (selectedIdsParam) {
        setIsEditing(true); 
        setIsOwner(true);
        const ids = selectedIdsParam.split(',');
        const { data } = await supabase.from('markets').select('*').in('id', ids);
        loadedMarkets = data || [];
        setBundleName("New Analysis Bundle");
      }
      
      setMarkets(loadedMarkets);
      setLoading(false);

      verifyBatchStatus(loadedMarkets);
    }

    init();
  }, [searchParams, address]);

  // --- LIVE STATUS CHECKER ---
  async function verifyBatchStatus(marketList: any[]) {
    const activeMarkets = marketList.filter(m => m.active);
    activeMarkets.forEach(async (m) => {
      try {
        const extId = m.external_id || m.condition_id;
        const res = await fetch(`/api/check-status?id=${m.id}&platform=${m.platform}&external_id=${extId}`);
        if (res.ok) {
          const result = await res.json();
          if (result.updated || result.status === 'resolved') {
             console.log(`⚡ Workspace Repair: ${m.title} resolved`);
             setMarkets(prev => prev.map(pm => 
               pm.id === m.id ? { ...pm, active: false, status: 'resolved', winning_outcome: result.winner } : pm
             ));
          } else if (result.livePrice) {
             setMarkets(prev => prev.map(pm => 
               pm.id === m.id ? { ...pm, current_yes_price: result.livePrice, best_ask_yes: result.livePrice } : pm
             ));
          }
        }
      } catch (e) {}
    });
  }

  // --- ACTIONS ---
  const handleSave = async () => {
    if (!address) return alert("Connect wallet to save.");
    if (!bundleName.trim()) return alert("Bundle name is required.");
    setIsSaving(true);

    try {
      if (bundleId && isOwner) {
        // UPDATE (Only if Owner)
        await supabase.from('watchlists').update({ name: bundleName, description: description }).eq('id', bundleId);
      } else {
        // CREATE NEW / CLONE (For visitors or new drafts)
        const { data: newWl } = await supabase
          .from('watchlists')
          .insert({ user_wallet: address, name: bundleName, description: description })
          .select().single();
        
        if (newWl) {
          const items = markets.map(m => ({ watchlist_id: newWl.id, market_id: m.id }));
          await supabase.from('watchlist_items').insert(items);
          
          alert("Bundle saved to your Library!");
          router.replace(`/workspace?id=${newWl.id}`);
          setBundleId(newWl.id);
          setIsOwner(true); // Now you own this copy
        }
      }
      setIsEditing(false);
    } catch (e) { console.error(e); alert("Error saving."); }
    setIsSaving(false);
  };

  const handleRemoveMarket = async (marketId: string) => {
    if (!confirm("Remove this market?")) return;
    setMarkets(prev => prev.filter(m => m.id !== marketId));
    if (bundleId && isOwner) {
      await supabase.from('watchlist_items').delete().eq('watchlist_id', bundleId).eq('market_id', marketId);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("🔗 Link copied!");
  };

  if (loading) return <div className="loading-wrapper"><div className="spinner"></div></div>;

  return (
    <div className="mobile-container-dark" style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      
      {/* HEADER */}
      <div className="workspace-header">
        <div className="ws-top-bar">
           <span className="ws-badge">WORKSPACE</span>
           {createdAt && <span className="ws-date">{createdAt}</span>}
        </div>

        {isEditing ? (
          <div className="ws-editor fade-in">
             <input className="ws-input-title" value={bundleName} onChange={e => setBundleName(e.target.value)} placeholder="Bundle Name" />
             <textarea className="ws-input-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Add thesis..." />
             <div className="ws-actions">
                <button onClick={() => setIsEditing(false)} className="btn-text cancel">Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="btn-primary-small">{isSaving ? 'Saving...' : 'Save'}</button>
             </div>
          </div>
        ) : (
          <div className="ws-display fade-in">
             <h1 className="ws-hero-title">{bundleName}</h1>
             {description && <p className="ws-hero-desc">"{description}"</p>}
             
             <div className="ws-meta-footer">
                <span className="curator">Curated by <span className="highlight">{creator || 'Anon'}</span></span>
                <div className="ws-controls">
                   <button onClick={handleShare} className="icon-btn-circle">🔗</button>
                   
                   {/* OWNER gets Edit, VISITOR gets Clone */}
                   {isOwner ? (
                     <button onClick={() => setIsEditing(true)} className="icon-btn-circle">✎</button>
                   ) : (
                     <button onClick={handleSave} className="icon-btn-pill" style={{ marginLeft:'10px' }}>
                       💾 Save Copy
                     </button>
                   )}
                </div>
             </div>
          </div>
        )}
      </div>

      {/* CHART COMPARISON */}
      {markets.length > 0 && (
        <div className="ws-chart-wrapper">
          <CompareChart markets={markets} />
        </div>
      )}

      {/* MARKETS LIST */}
      <h3 className="ws-section-title">Analysis Feed ({markets.length})</h3>
      <div className="ws-list-stack">
        {markets.length === 0 ? (
           <div className="empty-state-box">Empty Bundle. Go to Home to add markets.</div>
        ) : (
           markets.map(m => {
             const book = getOrderBook(m);
             const tradeUrl = getMarketUrl(m);
             const isResolved = !m.active || m.status === 'resolved';
             const displayPrice = (book.buyYes * 100).toFixed(1);
             const isArb = (book.buyYes + book.buyNo) < 0.99;

             return (
               <div key={m.id} className={`workspace-card-item ${isArb ? 'arb-border' : ''}`}>
                  
                  {/* HERO SECTION */}
                  <div className="ws-card-hero">
                     
                     {/* DELETE BUTTON (Owner Editing OR Draft Mode) */}
                     {(isEditing || (!bundleId)) && (
                        <button 
                          className="mac-close-btn"
                          onClick={(e) => {
                             e.stopPropagation(); 
                             handleRemoveMarket(m.id);
                          }}
                        >
                          ×
                        </button>
                     )}

                     <div style={{ display: 'flex', gap: '15px' }}>
                        <img 
                          src={m.image_url} 
                          className="hero-image-small" 
                          onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                        <div style={{ flex: 1, paddingRight: '30px' }}> 
                           <h3 className="ws-card-title">{m.title}</h3>
                           <div className="ws-card-meta">
                              <span className={`platform-tag ${m.platform.toLowerCase()}`}>{m.platform}</span>
                              <span>•</span>
                              <span>{isResolved ? 'Resolved' : `Ends ${new Date(m.end_date).toLocaleDateString()}`}</span>
                              <span>•</span>
                              <a href={tradeUrl} target="_blank" className="trade-link-simple">Trade ↗</a>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* ORDER BOOK */}
                  <div className="order-book-section compact">
                    <div className="order-book-grid">
                       <div className="book-card yes">
                          <span className="book-type">Buy Yes</span>
                          <span className="book-price">{displayPrice}¢</span>
                          <div className="divider"></div>
                          <span className="book-sub">Sell: {(book.sellYes * 100).toFixed(1)}¢</span>
                       </div>
                       <div className="book-card no">
                          <span className="book-type">Buy No</span>
                          <span className="book-price">{(book.buyNo * 100).toFixed(1)}¢</span>
                          <div className="divider"></div>
                          <span className="book-sub">Sell: {(book.sellNo * 100).toFixed(1)}¢</span>
                       </div>
                    </div>
                  </div>

                  {/* VOTING */}
                  <div style={{ padding: '0 16px 16px 16px' }}>
                     <MarketVotingCard 
                        market={m} 
                        userAddress={address} 
                        isDetailView={true} 
                     />
                  </div>

               </div>
             );
           })
        )}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
    return (
        <Suspense fallback={<div className="loading-wrapper">Loading...</div>}>
            <WorkspaceContent />
        </Suspense>
    )
}
