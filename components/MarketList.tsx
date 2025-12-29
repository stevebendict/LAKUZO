'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Market {
  id: string;
  title: string;
  platform: string;
  volume_usd: number;
  current_yes_price: number;
  best_ask_yes: number | null;
  best_ask_no: number | null;
  image_url: string;
  end_date: string;
  active: boolean;
  winning_outcome: string | null;
}

const formatEnding = (dateString: string) => {
  const end = new Date(dateString);
  const now = new Date();
  const diffHours = (end.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) return "Ended";
  if (diffHours < 24) return `${Math.ceil(diffHours)}h Left`;
  if (diffHours < 48) return "Tomorrow";
  
  // ✅ LOGIC MAINTAINED: Year is included
  return end.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }); 
};

export default function MarketList() {
  const router = useRouter();
  
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // --- FILTERS ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [platform, setPlatform] = useState('ALL'); 
  const [status, setStatus] = useState('ACTIVE'); 
  const [sortBy, setSortBy] = useState('volume_desc');
  // ✅ FEATURE RESTORED: Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchMarkets(0, true); 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, status, sortBy, debouncedSearch, startDate, endDate]); 

  async function fetchMarkets(pageIndex: number, isFresh: boolean) {
    if (isFresh) setLoading(true);
    
    let query = supabase.from('markets').select('*');

    if (debouncedSearch.trim()) query = query.ilike('title', `%${debouncedSearch}%`);
    
    // ✅ LOGIC MAINTAINED: Live = Future Only
    if (status === 'ACTIVE') {
      query = query.eq('active', true).gt('end_date', new Date().toISOString());
    } 
    else if (status === 'RESOLVED') {
      query = query.eq('active', false);
    }
    
    if (platform !== 'ALL') query = query.ilike('platform', platform); 
    
    // ✅ FEATURE RESTORED: Date Query Logic
    if (startDate) query = query.gte('end_date', startDate);
    if (endDate) query = query.lte('end_date', endDate);

    switch (sortBy) {
      case 'volume_desc': query = query.order('volume_usd', { ascending: false }); break;
      case 'volume_asc': query = query.order('volume_usd', { ascending: true }); break;
      case 'ending_asc': query = query.order('end_date', { ascending: true }); break;
      case 'ending_desc': query = query.order('end_date', { ascending: false }); break;
      default: query = query.order('volume_usd', { ascending: false });
    }

    const ITEMS_PER_PAGE = 20;
    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    const { data, error } = await query.range(from, to);

    if (!error && data) {
      const newMarkets = data as Market[];
      if (newMarkets.length < ITEMS_PER_PAGE) setHasMore(false);
      
      if (isFresh) setMarkets(newMarkets);
      else setMarkets(prev => [...prev, ...newMarkets]);
    }
    setLoading(false);
  }

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchMarkets(next, false);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  return (
    // ✅ UI FIX: Using Dark Mode Class
    <div className="mobile-container-dark">
      
      {/* --- HEADER --- */}
      <div className="sticky-header-dark">
        <input 
          type="text" 
          placeholder="🔍 Search markets..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-bar-dark"
        />
        
        <div className="filter-row">
           <select value={status} onChange={e => setStatus(e.target.value)} className="pill-select-dark">
             <option value="ACTIVE">🟢 Live Only</option>
             <option value="ALL">All Status</option>
             <option value="RESOLVED">🏁 Resolved</option>
           </select>

           <select value={platform} onChange={e => setPlatform(e.target.value)} className="pill-select-dark">
             <option value="ALL">All Apps</option>
             <option value="Kalshi">Kalshi</option>
             <option value="Polymarket">Polymarket</option>
           </select>
           
           <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="pill-select-dark flex-grow">
             <option value="volume_desc">🔥 High Vol</option>
             <option value="volume_asc">Low Vol</option>
             <option value="ending_asc">⏳ Ends Soon</option>
             <option value="ending_desc">Ends Later</option>
           </select>
        </div>

        {/* ✅ FEATURE RESTORED: Date Pickers */}
        <div className="filter-row mt-2">
            <div className="date-group-dark">
                <span className="tiny-label">Ends After</span>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="date-input-dark"/>
            </div>
            <div className="date-group-dark">
                <span className="tiny-label">Ends Before</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="date-input-dark"/>
            </div>
        </div>
      </div>

      {/* --- MARKET FEED --- */}
      <div className="market-feed">
        {loading && <div className="loading-spinner-dark">Scanning Markets...</div>}

        {!loading && markets.map((market) => {
          const isSelected = selectedIds.has(market.id);
          const yesPrice = market.best_ask_yes ?? market.current_yes_price;
          const noPrice = market.best_ask_no ?? (1 - (yesPrice || 0.5));
          
          const totalCost = (yesPrice || 0) + (noPrice || 0);
          
          // ✅ FEATURE RESTORED: Full Arbitrage Logic (Buy & Mint)
          const isBuyArb = totalCost < 0.99 && market.active;
          const isMintArb = totalCost > 1.01 && market.active;
          const isArb = isBuyArb || isMintArb;
          
          let profitText = '';
          if (isBuyArb) profitText = `Buy Arb (+${((1 - totalCost) * 100).toFixed(1)}%)`;
          if (isMintArb) profitText = `Mint Arb (+${((totalCost - 1) * 100).toFixed(1)}%)`;

          return (
            <div 
              key={market.id}
              onClick={() => router.push(`/market?id=${market.id}`)}
              className={`market-card-dark ${isSelected ? 'selected' : ''} ${isArb ? 'arb-glow-gold' : ''}`}
            >
              {isArb && <div className="arb-badge-gold">⚡ {profitText}</div>}

              <div className="card-top">
                {/* ✅ FEATURE RESTORED: Kalshi "K" Placeholder */}
                {market.platform === 'Kalshi' ? (
                  <div className="kalshi-k-placeholder">K</div>
                ) : (
                  <img 
                    src={market.image_url} 
                    className="market-icon"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}

                <div className="card-meta">
                  <h3 className="market-title-dark">{market.title}</h3>
                  <div className="market-stats-dark">
                    <span className={`platform-tag ${market.platform.toLowerCase()}`}>{market.platform}</span>
                    <span>${(market.volume_usd / 1000).toFixed(0)}k Vol</span>
                    <span className={new Date(market.end_date) < new Date(Date.now() + 86400000) ? 'text-urgent' : ''}>
                      {formatEnding(market.end_date)}
                    </span>
                  </div>
                </div>
                
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleSelection(market.id); }}
                  className={`check-circle ${isSelected ? 'checked' : ''}`}
                >
                  {isSelected && '✓'}
                </div>
              </div>

              <div className="card-actions">
                <div className="price-btn-dark yes-btn-dark">
                  <span className="label">YES</span>
                  <span className="val">{market.active ? (yesPrice * 100).toFixed(0) + '¢' : '-'}</span>
                </div>

                <div className="price-btn-dark no-btn-dark">
                  <span className="label">NO</span>
                  <span className="val">{market.active ? (noPrice * 100).toFixed(0) + '¢' : '-'}</span>
                </div>
              </div>
            </div>
          );
        })}

        {hasMore && !loading && (
           <button onClick={loadMore} className="load-more-dark">Load More Markets ↓</button>
        )}
        
        <div className="spacer-bottom" />
      </div>

      {selectedIds.size > 0 && (
        <div className="fab-container">
          <button 
            onClick={() => router.push(`/workspace?ids=${Array.from(selectedIds).join(',')}`)}
            className="fab-btn-dark"
          >
            Analyze {selectedIds.size} Markets →
          </button>
        </div>
      )}
    </div>
  );
}
