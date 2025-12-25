'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LAKUZO_ABI } from '@/utils/abi';

const CONTRACT_ADDRESS = '0x4a5D74D83075C995ae4b8aE3c946c5f084896ae0';
const CHAIN_ID = 84532; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MarketVotingCard({ market, userAddress }: { market: any, userAddress?: string }) {
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState<'YES' | 'NO' | null>(null);
  
  // METRICS STATE
  const [metrics, setMetrics] = useState({ 
    yesRepAvg: 0,   // Smart Money (Avg Score)
    noRepAvg: 0,
    crowdYesPct: 50, // Crowd Sentiment (% Count)
    totalVotes: 0
  });

  const { data: hash, writeContract } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (userAddress) checkStatus();
    if (!market.active) fetchDetailedSentiment();
  }, [userAddress, market.id]);

  useEffect(() => {
    if (isConfirmed && isVoting && userAddress) saveVote();
  }, [isConfirmed]);

  async function checkStatus() {
    const { data } = await supabase.from('votes').select('id').eq('market_id', market.id).eq('wallet_address', userAddress).maybeSingle();
    if (data) {
      setHasVoted(true);
      fetchDetailedSentiment();
    }
  }

  // --- REVISED LOGIC ---
  async function fetchDetailedSentiment() {
    const { data: votes } = await supabase.from('votes').select('choice, weight_at_time').eq('market_id', market.id);
    if (!votes?.length) return;

    let yesRepTotal = 0, noRepTotal = 0;
    let yesCount = 0, noCount = 0;

    votes.forEach(v => {
      if (v.choice === 'YES') {
        yesRepTotal += v.weight_at_time;
        yesCount++;
      } else {
        noRepTotal += v.weight_at_time;
        noCount++;
      }
    });

    const totalCount = yesCount + noCount;

    setMetrics({
      yesRepAvg: yesCount > 0 ? Math.round(yesRepTotal / yesCount) : 0,
      noRepAvg: noCount > 0 ? Math.round(noRepTotal / noCount) : 0,
      crowdYesPct: totalCount > 0 ? Math.round((yesCount / totalCount) * 100) : 50,
      totalVotes: totalCount
    });
  }

  async function saveVote() {
    await supabase.from('users').upsert({ wallet_address: userAddress, reputation_score: 100 }, { onConflict: 'wallet_address', ignoreDuplicates: true });
    
    // Get latest score
    const { data: user } = await supabase.from('users').select('reputation_score').eq('wallet_address', userAddress).single();
    const currentRep = user?.reputation_score || 100;

    await supabase.from('votes').insert({
      wallet_address: userAddress,
      market_id: market.id,
      choice: isVoting,
      weight_at_time: currentRep, 
      tx_hash: hash
    });
    setHasVoted(true);
    fetchDetailedSentiment();
  }

  const handleVote = (choice: 'YES' | 'NO') => {
    if (!userAddress) return alert("Connect Wallet first");
    setIsVoting(choice);
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: LAKUZO_ABI,
      functionName: 'castVote',
      args: [market.id, choice === 'YES'],
      chainId: CHAIN_ID, 
    });
  };

  const isEnded = !market.active;
  const yesPrice = market.best_ask_yes ?? market.current_yes_price;
  const noPrice = market.best_ask_no ?? (market.current_yes_price ? 1 - market.current_yes_price : 0);
  
  // Arbitrage Check
  const totalCost = (yesPrice || 0) + (noPrice || 0);
  const isArb = totalCost > 0 && totalCost < 0.99 && market.active;

  return (
    <div className={`voting-card-row ${isArb ? 'arb-glow' : ''}`}>
      
      {/* 1. HEADER ROW (Title Left, Prices Right) */}
      <div className="card-top-row">
        
        {/* LEFT: ICON + TITLE */}
        <div className="card-title-group">
           <img src={market.image_url || '/placeholder.png'} className="mini-icon" onError={e=>e.currentTarget.style.display='none'}/>
           <div>
             <span className="mini-title">{market.title}</span>
             {/* Inside 'card-title-group' -> inside the div next to the image */}

<div className="mini-meta-row">
   {/* 1. Platform & Vol */}
   <span>{market.platform}</span>
   <span className="meta-sep">•</span>
   <span>${Number(market.volume_usd).toLocaleString()} Vol</span>
   
   {/* 2. ADD THIS: End Date */}
   <span className="meta-sep">•</span>
   <span>Ends {new Date(market.end_date).toLocaleDateString()}</span>
   
   {/* 3. ADD THIS: Source Link */}
   <span className="meta-sep">•</span>
   <a 
     href={market.source_url} 
     target="_blank" 
     rel="noopener noreferrer"
     className="meta-link"
     onClick={(e) => e.stopPropagation()} // Stop card click
   >
     Open ↗
   </a>

   {/* Arb Tag (Keep if you have it) */}
   {isArb && <span className="arb-text" style={{marginLeft:'5px'}}>⚡ ARB</span>}
</div>
           </div>
        </div>

        {/* RIGHT: PRICES (Aligned with Title) */}
        <div className="card-price-group">
          {market.active ? (
            <>
              <div className="price-badge yes">YES ${yesPrice?.toFixed(2) || '-'}</div>
              <div className="price-badge no">NO ${noPrice?.toFixed(2) || '-'}</div>
            </>
          ) : (
            <span className={`status-badge ${market.winning_outcome ? 'won' : 'ended'}`}>
               {market.winning_outcome ? `${market.winning_outcome} WON` : 'ENDED'}
            </span>
          )}
        </div>
      </div>

      {/* 2. ACTION / SENTIMENT AREA */}
      <div className="card-bottom-row">
        {(hasVoted || isEnded) ? (
          <div className="sentiment-compact">
             
             {/* SMART MONEY (AVG REP) */}
             <div className="sent-col">
               <span className="sent-label-tiny">🧠 AVG REP</span>
               <div className="sent-values">
                 <span className="text-green">{metrics.yesRepAvg}</span>
                 <span className="text-muted">vs</span>
                 <span className="text-red">{metrics.noRepAvg}</span>
               </div>
             </div>

             {/* CROWD SENTIMENT (% COUNT) */}
             <div className="sent-col wide">
               <span className="sent-label-tiny">👥 CROWD ({metrics.totalVotes})</span>
               <div className="bar-mini-wrapper">
                 <div className="bar-mini-fill" style={{width: `${metrics.crowdYesPct}%`}}></div>
               </div>
               <div className="sent-pcts">
                 <span>{metrics.crowdYesPct}% YES</span>
                 <span>{100 - metrics.crowdYesPct}% NO</span>
               </div>
             </div>

          </div>
        ) : (
          <div className="btn-group-full">
             <button onClick={() => handleVote('YES')} disabled={!!isVoting} className="btn-vote yes">
               {isVoting === 'YES' ? '...' : 'Vote YES'}
             </button>
             <button onClick={() => handleVote('NO')} disabled={!!isVoting} className="btn-vote no">
               {isVoting === 'NO' ? '...' : 'Vote NO'}
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
