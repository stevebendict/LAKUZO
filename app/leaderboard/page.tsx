'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useAccount } from 'wagmi';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LeaderboardPage() {
  const { address } = useAccount();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [displayedUsers, setDisplayedUsers] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set()); // Track who we follow
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. FETCH DATA (Users + My Follows)
  useEffect(() => {
    async function init() {
      // A. Fetch Top 1000
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .order('reputation_score', { ascending: false })
        .limit(1000);
      
      const rankedData = (users || []).map((user, index) => ({
        ...user,
        globalRank: index + 1
      }));

      setAllUsers(rankedData);
      setDisplayedUsers(rankedData);

      // B. Fetch My Follows (if connected)
      if (address) {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_address')
          .eq('follower_address', address);
        
        if (follows) {
          setFollowingIds(new Set(follows.map(f => f.following_address)));
        }
      }

      setLoading(false);
    }
    init();
  }, [address]);

  // 2. SEARCH FILTER
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDisplayedUsers(allUsers);
      return;
    }
    const term = searchQuery.toLowerCase();
    const filtered = allUsers.filter(user => {
      const wallet = user.wallet_address.toLowerCase();
      const username = (user.username || '').toLowerCase();
      return username.includes(term) || wallet.includes(term);
    });
    setDisplayedUsers(filtered);
  }, [searchQuery, allUsers]);

  // 3. FOLLOW ACTION
  const handleFollowToggle = async (e: React.MouseEvent, targetAddr: string) => {
    e.preventDefault(); // Stop clicking row link
    if (!address) return alert("Connect wallet to follow.");

    const isFollowing = followingIds.has(targetAddr);
    
    // Optimistic Update
    const next = new Set(followingIds);
    if (isFollowing) next.delete(targetAddr);
    else next.add(targetAddr);
    setFollowingIds(next);

    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_address', address).eq('following_address', targetAddr);
    } else {
      await supabase.from('follows').insert({ follower_address: address, following_address: targetAddr });
    }
  };

  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      
      <div className="header-top-stacked">
         <div>
           <h1 className="section-title">Global Leaderboard</h1>
           <span className="live-badge" style={{color:'#fbbf24'}}>🏆 TOP 1000 TRADERS</span>
         </div>
         <input 
           type="text" 
           placeholder="Search trader..." 
           className="search-bar-leaderboard"
           value={searchQuery}
           onChange={(e) => setSearchQuery(e.target.value)}
         />
      </div>

      {loading ? <div className="loading">Loading Ranks...</div> : (
        <div className="ranking-list">
           <div className="rank-row header">
              <div className="rank-num">#</div>
              <div className="rank-user">Trader</div>
              <div className="rank-action">Action</div> 
              <div className="rank-score">Rep Score</div>
           </div>

           {displayedUsers.length === 0 ? <div className="empty-search">No traders found.</div> : 
             displayedUsers.map((user) => {
               const linkSlug = user.username ? `@${user.username}` : user.wallet_address;
               const isTop3 = user.globalRank <= 3;
               const isMe = address && user.wallet_address.toLowerCase() === address.toLowerCase();
               const isFollowing = followingIds.has(user.wallet_address);

               return (
                 <Link href={`/profile?slug=${linkSlug}`} key={user.wallet_address} className="rank-link-wrapper">
                   <div className={`rank-row ${isTop3 ? 'top-tier' : ''}`}>
                      {/* RANK */}
                      <div className="rank-num">
                         {user.globalRank <= 3 ? ['🥇','🥈','🥉'][user.globalRank-1] : user.globalRank}
                      </div>

                      {/* USER (No Avatar) */}
                      <div className="rank-user">
                         <div className="user-details-clean">
                            <span className={`addr ${user.username ? 'named' : 'anon'}`}>
                               {user.username ? `@${user.username}` : formatAddress(user.wallet_address)}
                            </span>
                            {isTop3 && <span className="pro-tag">ELITE</span>}
                            {isMe && <span className="me-tag">YOU</span>}
                         </div>
                      </div>

                      {/* FOLLOW BUTTON */}
                      <div className="rank-action">
                        {!isMe && (
                           <button 
                             className={`mini-follow-btn ${isFollowing ? 'active' : ''}`}
                             onClick={(e) => handleFollowToggle(e, user.wallet_address)}
                           >
                             {isFollowing ? 'Unfollow' : 'Follow'}
                           </button>
                        )}
                      </div>

                      {/* SCORE */}
                      <div className="rank-score">{user.reputation_score}</div>
                   </div>
                 </Link>
               );
             })
           }
        </div>
      )}
    </div>
  );
}
