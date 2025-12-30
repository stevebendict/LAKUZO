'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAccount } from 'wagmi';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';

// COMPONENTS
import MarketChart from '@/components/MarketChart';
import MarketVotingCard from '@/components/MarketVotingCard';

// UTILS
import { getMarketUrl, getOrderBook, MarketData } from '@/utils/marketUtils';

function MarketContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  
  const { address, isConnected } = useAccount();
  
  // --- STATE ---
  const [market, setMarket] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  // 1. INITIAL LOAD
  useEffect(() => {
    if (!id) return;

    async function init() {
      // A. Fetch Market from DB
      const { data, error } = await supabase
        .from('markets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        console.error('Market not found');
        setLoading(false);
        return;
      }
      setMarket(data);

      // B. Load History (From DB/Scraper)
      // We rely on the scraper's 'price_history_7d' for the chart.
      if (data.price_history_7d && Array.isArray(data.price_history_7d)) {
        setHistory(data.price_history_7d);
      }

      // C. Check Resolution
      // If DB says closed (active=false), trust it.
      const dbResolved = !data.active || data.status === 'closed' || data.status === 'resolved';
      setIsResolved(dbResolved);

      if (address) checkWatchlist(data.id);
      
      // D. User-Sweeper (Lazy Repair)
      // If DB says "Active", double-check with the Live API to see if it just ended.
      if (!dbResolved) {
        verifyRealTimeStatus(data);
      }

      setLoading(false);
    }
    init();
  }, [id, address]);

  // --- ACTIONS ---

  // This checks the Live API (Polymarket/Kalshi) via your new route
  async function verifyRealTimeStatus(marketData: any) {
    try {
      const extId = marketData.external_id || marketData.condition_id;
      
      // Call your backend route to verify status
      const res = await fetch(`/api/check-status?id=${marketData.id}&platform=${marketData.platform}&external_id=${extId}`);
      
      if (res.ok) {
        const result = await res.json();
        
        // CASE 1: Market is actually Resolved (DB updated by route)
        if (result.updated || result.status === 'resolved') {
          console.log("⚡ Live Update: Market just resolved!");
          setIsResolved(true);
          
          // Update local market object so UI (Voting Card) updates immediately
          setMarket((prev: any) => ({ 
             ...prev, 
             active: false, 
             status: 'resolved',
             winning_outcome: result.winner || prev.winning_outcome 
          }));
        } 
        // CASE 2: Market is Active -> Get Live Price for display
        else if (result.livePrice) {
           setLivePrice(result.livePrice);
        }
      }
    } catch (e) {
      console.warn("Background check skipped", e);
    }
  }

  async function checkWatchlist(marketId: string) {
      try {
          const { data: wl } = await supabase
            .from('watchlist_items')
            .select('id, watchlists!inner(user_wallet)')
            .eq('market_id', marketId)
            .eq('watchlists.user_wallet', address)
            .maybeSingle();
          if (wl) setIsWatchlisted(true);
      } catch (e) {}
  }

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      alert("🔗 Link copied!");
    }
  };

  const handleWatchlist = async () => {
    if (!address) return alert("Please connect wallet first.");

    try {
      if (isWatchlisted) {
        // REMOVE
        // Find ALL watchlists owned by this wallet
        const { data: lists } = await supabase.from('watchlists').select('id').ilike('user_wallet', address);
        
        if (lists && lists.length > 0) {
          const listIds = lists.map(l => l.id);
          // Remove this market from ANY of them
          await supabase.from('watchlist_items')
            .delete()
            .in('watchlist_id', listIds)
            .eq('market_id', market.id);
            
          setIsWatchlisted(false);
        }
      } else {
        // ADD
        // 1. Try to find the default "My Watchlist" for this wallet
        let { data: targetList } = await supabase
          .from('watchlists')
          .select('id')
          .ilike('user_wallet', address)
          .eq('name', 'My Watchlist')
          .maybeSingle();

        // 2. If it doesn't exist, create it (Wallet-First approach)
        if (!targetList) {
             const { data: newList, error } = await supabase
              .from('watchlists')
              .insert({ 
                user_wallet: address, 
                name: 'My Watchlist',
                description: 'Default favorites'
                // We do NOT send user_id anymore
              })
              .select()
              .single();
             
             if (error) throw error;
             targetList = newList;
        }

        if (targetList) {
          await supabase.from('watchlist_items').insert({ 
            watchlist_id: targetList.id, 
            market_id: market.id 
          });
          setIsWatchlisted(true);
        }
      }
    } catch (error: any) {
      console.error("Watchlist Error:", error.message);
      alert("Could not update watchlist.");
    }
  };

  if (loading || !market) {
    return (
      <div className="loading-wrapper">
         <div className="spinner"></div>
         <span>Loading Market Data...</span>
      </div>
    );
  }

  const book = getOrderBook(market as MarketData);
  const tradeUrl = getMarketUrl(market as MarketData);
  const isArb = (book.buyYes + book.buyNo) < 0.99;
  
  // LIVE PRICE PRIORITY: API > Scraper
  const currentPriceRaw = livePrice ?? book.buyYes;
  const displayPrice = (currentPriceRaw * 100).toFixed(1);

  return (
    <div className="mobile-container-dark">
      <div className={`market-hero ${isArb ? 'arb-highlight' : ''}`}>
        <div className="hero-content" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
           <div style={{ display: 'flex', gap: '15px', flex: 1 }}>
              <img 
                src={market.image_url} 
                className="hero-image"
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
              <div>
                 <h1 className="hero-title">{market.title}</h1>
                 <div className="hero-meta">
                    <span className={`platform-tag ${market.platform.toLowerCase()}`}>{market.platform}</span>
                    <span>•</span>
                    <span>{isResolved ? 'Resolved' : `Ends ${new Date(market.end_date).toLocaleDateString()}`}</span>
                    <span>•</span>
                    <a href={tradeUrl} target="_blank" className="trade-link-simple">Trade on App ↗</a>
                 </div>
              </div>
           </div>
           <div className="hero-actions">
              <button onClick={handleWatchlist} className={`icon-btn-hero ${isWatchlisted ? 'active' : ''}`}>
                 {isWatchlisted ? '★' : '☆'}
              </button>
              <button onClick={handleShare} className="icon-btn-hero">🔗</button>
           </div>
        </div>

        {/* CHART CONTAINER */}
        <div style={{ marginTop: '20px' }}>
           <MarketChart 
              history={history} 
              currentPrice={currentPriceRaw}
              isResolved={isResolved} 
           />
        </div>
      </div>

      <div className="order-book-section">
        <div className="section-header-row">
          <span className="section-label">Order Book</span>
          {isArb && <span className="arb-alert">⚡ Arb Detected</span>}
        </div>
        <div className="order-book-grid">
           <div className="book-card yes">
              <span className="book-type">Buy Yes</span>
              <span className="book-price">{displayPrice}¢</span>
              <div className="divider"></div>
              <span className="book-sub">Sell Yes: {(book.sellYes * 100).toFixed(1)}¢</span>
           </div>
           <div className="book-card no">
              <span className="book-type">Buy No</span>
              <span className="book-price">{((1 - currentPriceRaw) * 100).toFixed(1)}¢</span>
              <div className="divider"></div>
              <span className="book-sub">Sell No: {(book.sellNo * 100).toFixed(1)}¢</span>
           </div>
        </div>
      </div>

      <div style={{ marginBottom: '100px' }}>
         <MarketVotingCard market={market} userAddress={address} isDetailView={true} />
      </div>

      {!isConnected && (
  <div className="wallet-gate-overlay">
    <div className="wallet-gate-card">
      <div className="gate-icon">🔐</div>
      
      <div>
        <h3 className="gate-title">Unlock Market Data</h3>
        <p className="gate-desc">
          Connect your wallet to analyze live odds, spot arbitrage, and track your reputation.
        </p>
      </div>

      {/* The Button */}
      <ConnectWallet className="cb-wallet-custom" />
      
      {/* Optional: Trust Badge */}
      <span style={{ fontSize: '10px', color: '#555', marginTop: '8px' }}>
        Powered by Base & Coinbase
      </span>
    </div>
  </div>
)}
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <MarketContent />
    </Suspense>
  );
}
