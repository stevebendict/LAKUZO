'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import debounce from 'lodash/debounce';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ITEMS_PER_PAGE = 50;

// --- BADGE UTILS (Export this to a util file later to use on Profile/Dashboard) ---
export const getRankBadge = (rank: number) => {
  if (rank === 1) return { label: '👑 GOAT', color: '#fbbf24', border: '2px solid #fbbf24' };
  if (rank === 2) return { label: '🥈 LEGEND', color: '#e5e7eb', border: '1px solid #e5e7eb' };
  if (rank === 3) return { label: '🥉 TITAN', color: '#d97706', border: '1px solid #d97706' };
  if (rank <= 10) return { label: '⚔️ WARLORD', color: '#ef4444', border: '1px solid #7f1d1d' };
  if (rank <= 100) return { label: '💎 DIAMOND', color: '#3b82f6', border: 'none' };
  if (rank <= 500) return { label: '🥇 GOLD', color: '#f59e0b', border: 'none' };
  return { label: '🪵 SCOUT', color: '#666', border: 'none' };
};

export default function LeaderboardPage() {
  const { address } = useAccount();
  
  // DATA STATE
  const [users, setUsers] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // SEARCH STATE
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // 1. INITIAL LOAD (My Follows + Top 50)
  useEffect(() => {
    fetchFollows();
    resetAndFetch(0, '');
  }, [address]);

  async function fetchFollows() {
    if (!address) return;
    const { data } = await supabase.from('follows').select('following_address').eq('follower_address', address);
    if (data) setFollowingIds(new Set(data.map(f => f.following_address)));
  }

  // 2. FETCH LOGIC (Smart Rank Preservation)
  async function fetchUsers(pageIndex: number, isFresh: boolean, queryStr: string) {
    setLoading(true);
    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    // NOTE: We query 'user_ranks' view, NOT 'users' table directly
    let query = supabase
      .from('user_ranks') 
      .select('*')
      .order('global_rank', { ascending: true }) // Always order by rank
      .range(from, to);

    // If searching, we filter ONLY by username/address, but global_rank is preserved by the View!
    if (queryStr) {
      // Use "or" for searching both fields
      query = query.or(`username.ilike.%${queryStr}%,wallet_address.ilike.%${queryStr}%`);
    }

    const { data } = await query;
    const newUsers = data || [];

    if (newUsers.length < ITEMS_PER_PAGE) setHasMore(false);

    if (isFresh) setUsers(newUsers);
    else setUsers(prev => [...prev, ...newUsers]);
    
    setLoading(false);
  }

  const resetAndFetch = (pIdx: number, q: string) => {
    setPage(pIdx);
    setHasMore(true);
    setUsers([]); // Clear list for fresh feel
    fetchUsers(pIdx, true, q);
  };

  // 3. DEBOUNCED SEARCH
  const handleSearch = (e: any) => {
    const val = e.target.value;
    setSearch(val);
    setIsSearching(!!val);
    debouncedSearch(val);
  };

  const debouncedSearch = useCallback(
    debounce((q: string) => resetAndFetch(0, q), 500),
    []
  );

  // 4. ACTIONS
  const handleFollow = async (e: React.MouseEvent, targetAddr: string) => {
    e.preventDefault();
    if (!address) return alert("Connect wallet to follow.");
    
    const isFollowing = followingIds.has(targetAddr);
    // Optimistic Update
    const next = new Set(followingIds);
    if (isFollowing) next.delete(targetAddr);
    else next.add(targetAddr);
    setFollowingIds(next);

    if (isFollowing) await supabase.from('follows').delete().eq('follower_address', address).eq('following_address', targetAddr);
    else await supabase.from('follows').insert({ follower_address: address, following_address: targetAddr });
  };

  return (
    <div className="mobile-container-dark" style={{ paddingBottom: '120px' }}>
      
      {/* HEADER WITH INFO POPUP */}
      <div className="header-top-stacked">
         <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
           <div>
             <h1 className="section-title">Leaderboard</h1>
             <span className="live-badge" style={{color:'#fbbf24'}}>🏆 SEASON 1</span>
           </div>
           
           {/* INFO ICON FOR MATH */}
           <div className="info-tooltip-container">
              <span className="info-icon">ℹ</span>
              <div className="tooltip-content">
                 <strong>Reputation Math</strong><br/>
                 Correct: +10 pts<br/>
                 Wrong: -10 pts<br/>
                 Streak: +5 bonus
              </div>
           </div>
         </div>

         {/* SEARCH BAR (Preserves Rank) */}
         <div className="ios-search-container" style={{marginTop:'15px'}}>
             <span className="search-icon">🔍</span>
             <input 
               type="text" 
               placeholder="Search @username or 0x..." 
               onChange={handleSearch} 
               className="ios-search-input"
             />
         </div>
      </div>

      <div className="ranking-list" style={{ marginTop: '20px' }}>
         {/* HEADER ROW */}
         <div className="rank-row header">
            <div className="rank-num">#</div>
            <div className="rank-user">Trader</div>
            <div className="rank-score">Rep</div>
         </div>

         {users.length === 0 && !loading ? (
             <div className="empty-search">No traders found.</div>
         ) : (
             users.map((user) => {
               const rank = user.global_rank; // From SQL View
               const badge = getRankBadge(rank);
               const isMe = address && user.wallet_address.toLowerCase() === address.toLowerCase();
               const isFollowing = followingIds.has(user.wallet_address);
               const displayId = user.username ? `@${user.username}` : `${user.wallet_address.slice(0,6)}...`;

               return (
                 <Link href={`/profile?address=${user.wallet_address}`} key={user.wallet_address} className="rank-link-wrapper">
                   <div className={`rank-row ${rank <= 3 ? 'top-tier-glow' : ''}`}>
                      
                      {/* 1. RANK & BADGE */}
                      <div className="rank-num">
                         <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                            <span style={{fontSize:'14px', fontWeight:'700'}}>{rank}</span>
                            {/* Tiny Rank Icon for Top 3 */}
                            {rank === 1 && '👑'}
                            {rank === 2 && '🥈'}
                            {rank === 3 && '🥉'}
                         </div>
                      </div>

                      {/* 2. USER DETAILS */}
                      <div className="rank-user">
                         <div className="user-details-clean">
                            <span className={`addr ${user.username ? 'named' : 'anon'}`}>
                               {displayId}
                            </span>
                            
                            {/* DYNAMIC BADGE */}
                            <span 
                              className="rank-badge-pill" 
                              style={{ 
                                color: badge.color, 
                                border: badge.border, 
                                background: badge.border !== 'none' ? 'rgba(0,0,0,0.3)' : 'transparent' 
                              }}
                            >
                               {badge.label}
                            </span>
                         </div>
                      </div>

                      {/* 3. REP & ACTION */}
                      <div className="rank-score-col">
                          <span className="score-val">{user.reputation_score}</span>
                          {!isMe && (
                             <button 
                               onClick={(e) => handleFollow(e, user.wallet_address)}
                               className={`mini-follow-text ${isFollowing ? 'following' : ''}`}
                             >
                               {isFollowing ? 'Unfollow' : 'Follow'}
                             </button>
                          )}
                      </div>

                   </div>
                 </Link>
               );
             })
         )}

         {hasMore && !loading && (
             <button onClick={() => setPage(p => p + 1)} className="load-more-btn">
                Load Next 50 ↓
             </button>
         )}
         {loading && <div className="loading-spinner-dark">Loading Ranks...</div>}
      </div>
    </div>
  );
}
