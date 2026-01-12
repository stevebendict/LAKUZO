'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import MarketPairCard from '@/components/MarketPairCard';

// Helper to calculate yield
const getYieldValue = (pair: any) => {
  const { poly_yes, poly_no, kalshi_yes, kalshi_no, match_type } = pair;
  let costA, costB;

  if (match_type === 'Inverse') {
    costA = (poly_yes || 0) + (kalshi_yes || 0);
    costB = (poly_no || 0) + (kalshi_no || 0);
  } else {
    costA = (poly_yes || 0) + (kalshi_no || 0);
    costB = (poly_no || 0) + (kalshi_yes || 0);
  }

  const minCost = Math.min(costA, costB);
  return minCost < 1 ? (1 - minCost) : -1; 
};

export default function PairsPage() {
  const router = useRouter();

  // --- STATE ---
  const [pairs, setPairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); 
  const [sortBy, setSortBy] = useState('yield_desc');

  // --- FETCH ---
  useEffect(() => {
    fetchPairs();
  }, []);

  async function fetchPairs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('detailed_market_pairs')
      .select('*');
    
    if (!error && data) {
      setPairs(data);
    }
    setLoading(false);
  }

  // --- LOGIC: Filter & Sort ---
  const filteredPairs = pairs
    .filter((pair) => {
      // 1. SMART CLEANUP: If either market is closed, hide the pair
      if (!pair.poly_active || !pair.kalshi_active) return false;

      // 2. Search Filter
      const term = search.toLowerCase();
      const matchesSearch = 
        pair.poly_title?.toLowerCase().includes(term) || 
        pair.kalshi_title?.toLowerCase().includes(term);

      // 3. Type Filter
      const matchesType = 
        filterType === 'ALL' ? true : 
        filterType === 'INVERSE' ? pair.match_type === 'Inverse' :
        pair.match_type !== 'Inverse';

      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      // 4. Sorting Logic
      if (sortBy === 'yield_desc') {
        return getYieldValue(b) - getYieldValue(a); // High Yield first
      }
      if (sortBy === 'ending_soon') {
        // Sort by whichever market ends sooner
        const endA = Math.min(new Date(a.poly_end_date).getTime(), new Date(a.kalshi_end_date).getTime());
        const endB = Math.min(new Date(b.poly_end_date).getTime(), new Date(b.kalshi_end_date).getTime());
        return endA - endB; // Earliest date first
      }
      if (sortBy === 'conf_desc') {
        return b.confidence_score - a.confidence_score;
      }
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

  return (
    <div className="mobile-container-dark">
      
      {/* --- STICKY HEADER --- */}
      <div className="sticky-header-dark">
        <input 
          type="text" 
          placeholder="🔍 Find arbitrage pairs..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-bar-dark"
        />
        
        <div className="filter-row">
           <select 
             value={filterType} 
             onChange={e => setFilterType(e.target.value)} 
             className="pill-select-dark"
           >
             <option value="ALL">All Pairs</option>
             <option value="DIRECT">🔗 Direct</option>
             <option value="INVERSE">🔄 Inverse</option>
           </select>

           <select 
             value={sortBy} 
             onChange={e => setSortBy(e.target.value)} 
             className="pill-select-dark flex-grow"
           >
             <option value="yield_desc">⚡ Highest Yield</option>
             <option value="ending_soon">⏳ Ending Soon</option>
             <option value="conf_desc">🤖 Confidence</option>
             <option value="newest">✨ Newest</option>
           </select>
        </div>
      </div>

      {/* --- FEED --- */}
      <div className="market-feed">
        {loading && (
           <div className="loading-spinner-dark">Scanning for Alpha...</div>
        )}

        {!loading && filteredPairs.length === 0 && (
          <div className="text-center" style={{ color: '#666', marginTop: '40px', padding: '20px' }}>
            <p style={{ fontWeight: 'bold' }}>No Active Pairs Found</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>
              We hide resolved markets automatically to ensure you only see live opportunities.
            </p>
          </div>
        )}

        {!loading && filteredPairs.map((pair) => (
          <MarketPairCard key={pair.pair_id} pair={pair} />
        ))}
        
        <div className="spacer-bottom" />
      </div>
    </div>
  );
}
