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
  // New fields for Order Book
  best_ask_yes: number | null;
  best_ask_no: number | null;
  image_url: string;
  end_date: string;
  active: boolean;
  winning_outcome: string | null;
}

export default function MarketList() {
  const router = useRouter();
  
  // --- STATE ---
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 50;

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [platform, setPlatform] = useState('ALL'); 
  const [status, setStatus] = useState('ACTIVE'); 
  const [sortBy, setSortBy] = useState('volume_desc');
  
  // Date Range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 1. DEBOUNCE
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 600);
    return () => clearTimeout(timer);
  }, [search]);

  // 2. FETCH TRIGGER
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchMarkets(0, true); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, status, sortBy, debouncedSearch, startDate, endDate]); 

  // 3. MASTER FETCH
  async function fetchMarkets(pageIndex: number, isFresh: boolean) {
    if (isFresh) setLoading(true);
    else setLoadingMore(true);
    
    let query = supabase.from('markets').select('*');

    // Filters
    if (debouncedSearch.trim()) query = query.ilike('title', `%${debouncedSearch}%`);
    if (status === 'ACTIVE') query = query.eq('active', true);
    else if (status === 'RESOLVED') query = query.eq('active', false);
    if (platform !== 'ALL') query = query.ilike('platform', platform); 
    if (startDate) query = query.gte('end_date', startDate);
    if (endDate) query = query.lte('end_date', endDate);

    // Sorting
    switch (sortBy) {
      case 'volume_desc': query = query.order('volume_usd', { ascending: false, nullsFirst: false }); break;
      case 'volume_asc': query = query.order('volume_usd', { ascending: true, nullsFirst: false }); break;
      case 'ending_asc': query = query.order('end_date', { ascending: true }); break;
      case 'ending_desc': query = query.order('end_date', { ascending: false }); break;
      default: query = query.order('volume_usd', { ascending: false });
    }

    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    const { data, error } = await query.range(from, to);

    if (error) {
      console.error('Error:', error);
    } else {
      const newMarkets = data || [];
      if (newMarkets.length < ITEMS_PER_PAGE) setHasMore(false);
      if (isFresh) setMarkets(newMarkets);
      else setMarkets(prev => [...prev, ...newMarkets]);
    }
    
    setLoading(false);
    setLoadingMore(false);
  }

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMarkets(nextPage, false);
  };

  const handleReset = () => {
    setSearch('');
    setPlatform('ALL');
    setStatus('ACTIVE');
    setSortBy('volume_desc');
    setStartDate('');
    setEndDate('');
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleGroupView = () => {
    const idsParam = Array.from(selectedIds).join(',');
    router.push(`/workspace?markets=${idsParam}`);
  };

  return (
    <div className="container">
      
      {/* CONTROLS (Same as before) */}
      <div className="screener-controls-v2">
        <div className="search-row">
          <input 
            type="text" 
            placeholder="Search markets..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input-full"
          />
        </div>
        <div className="filter-grid">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="filter-select">
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Live Only</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="filter-select">
            <option value="ALL">All Platforms</option>
            <option value="Polymarket">Polymarket</option>
            <option value="Kalshi">Kalshi</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
            <option value="volume_desc">High Volume</option>
            <option value="volume_asc">Low Volume</option>
            <option value="ending_asc">Ending Soon</option>
            <option value="ending_desc">Ending Later</option>
          </select>
          <button onClick={handleReset} className="reset-btn">Reset</button>
        </div>
        <div className="date-row">
           <div className="date-group">
             <span className="tiny-label">Ends After:</span>
             <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="date-input" />
           </div>
           <div className="date-group">
             <span className="tiny-label">Ends Before:</span>
             <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="date-input" />
           </div>
        </div>
      </div>

      {/* MARKET LIST */}
      <div className="market-list-container">
        {loading && <div className="loading">Fetching Data...</div>}
        
        {!loading && markets.length === 0 && (
          <div className="empty-state">No markets match your filters.</div>
        )}

        {!loading && markets.map((market) => {
          const isSelected = selectedIds.has(market.id);
          const hasValidImage = market.image_url && !market.image_url.includes('default.svg');

          // --- PRICE LOGIC ---
          // Fallback to "current_yes_price" if "best_ask" is empty
          const yesPrice = market.best_ask_yes ?? market.current_yes_price;
          // If NO ask is missing, calculate from YES (1 - yes) as placeholder
          const noPrice = market.best_ask_no ?? (market.current_yes_price ? 1 - market.current_yes_price : 0);
          
          // Check Arbitrage (Only if we have REAL asks)
          const totalCost = (market.best_ask_yes || 0) + (market.best_ask_no || 0);
          const isArb = market.best_ask_yes && market.best_ask_no && totalCost < 0.99 && market.active;

          return (
            <div 
              key={market.id} 
              className={`market-card-row ${isSelected ? 'selected' : ''} ${isArb ? 'arb-highlight' : ''}`}
              onClick={() => router.push(`/market?id=${market.id}`)}
            >
              {/* Checkbox */}
              <div 
                className="checkbox-area"
                onClick={(e) => { e.stopPropagation(); toggleSelection(market.id); }}
              >
                <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
                  {isSelected && '✓'}
                </div>
              </div>

              {/* Icon & Title */}
              <div className="content-area">
                <div className="icon-wrapper">
                  {hasValidImage ? (
                    <img src={market.image_url} alt="icon" className="market-icon" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                  ) : (
                    <div className="market-icon-placeholder kalshi-placeholder">K</div>
                  )}
                  <div className="market-icon-placeholder kalshi-placeholder hidden">K</div>
                </div>

                <div className="text-info">
                  <h3 className="market-title">{market.title}</h3>
                  <div className="meta-tags">
                    <span className={`platform-badge ${market.platform.toLowerCase()}`}>{market.platform}</span>
                    <span className="vol-badge">${Number(market.volume_usd).toLocaleString()} Vol</span>
                    {isArb && <span className="arb-badge">⚡ ARB OPPORTUNITY</span>}
                    {!market.active && <span className="status-badge ended">ENDED</span>}
                  </div>
                </div>
              </div>

              {/* NEW DUAL PRICE AREA */}
              <div className="dual-price-area">
                {market.active ? (
                  <>
                    <div className="price-box yes">
                      <span className="p-label">YES</span>
                      <span className="p-val">{yesPrice ? `$${yesPrice.toFixed(2)}` : '-'}</span>
                    </div>
                    <div className="price-box no">
                      <span className="p-label">NO</span>
                      <span className="p-val">{noPrice ? `$${noPrice.toFixed(2)}` : '-'}</span>
                    </div>
                  </>
                ) : (
                  // If Ended, show Winner
                  <div className={`winner-badge ${market.winning_outcome === 'YES' ? 'win-yes' : 'win-no'}`}>
                    {market.winning_outcome ? `${market.winning_outcome} WON` : 'RESOLVING'}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Load More */}
        {!loading && hasMore && (
          <button onClick={handleLoadMore} disabled={loadingMore} className="load-more-btn">
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>

      {/* FAB */}
      {selectedIds.size > 0 && (
        <div className="floating-fab-container">
          <button onClick={handleGroupView} className="fab-analyze-btn">
            Analyze {selectedIds.size} Markets
            <span className="arrow-icon">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
