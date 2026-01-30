'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useSwitchChain } from 'wagmi';
import { LAKUZO_CONTRACT_ADDRESS, LAKUZO_ABI } from '@/utils/constants';
import { supabase } from '@/lib/supabaseClient';

const TARGET_CHAIN_ID = 8453; 

interface Props {
  market: any;
  userAddress?: string;
  isDetailView?: boolean;
}

export default function MarketVotingCard({ market, userAddress, isDetailView = false }: Props) {
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState<'YES' | 'NO' | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [metrics, setMetrics] = useState({ 
    yesRepAvg: 0, noRepAvg: 0, crowdYesPct: 50, totalVotes: 0
  });

  const { chain } = useAccount(); 
  const { switchChain } = useSwitchChain();
  const { data: hash, writeContractAsync, error: writeError } = useWriteContract();
  const { isSuccess: isConfirmed, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  // prequisite

  const isEnded = market.active === false || market.status === 'closed' || market.status === 'resolved';

  useEffect(() => {
    if (userAddress) checkStatus();
    fetchDetailedSentiment();
    setIsReady(true);
  }, [userAddress, market.id, isEnded]);

  // save to db after confirmation
  useEffect(() => {
    if (isConfirmed && isVoting && userAddress) {
      saveVoteToSupabase();
    }
  }, [isConfirmed]);

  async function checkStatus() {
    const { data } = await supabase
      .from('votes')
      .select('id')
      .eq('market_id', market.id)
      .eq('wallet_address', userAddress)
      .maybeSingle();
      
    if (data) setHasVoted(true);
  }

  async function fetchDetailedSentiment() {
    const { data: votes } = await supabase
      .from('votes')
      .select('choice, weight_at_time')
      .eq('market_id', market.id);

    if (!votes?.length) return;

    let yesRepTotal = 0, noRepTotal = 0, yesCount = 0, noCount = 0;
    votes.forEach(v => {
      if (v.choice === 'YES') { yesRepTotal += v.weight_at_time; yesCount++; } 
      else { noRepTotal += v.weight_at_time; noCount++; }
    });

    const totalCount = yesCount + noCount;
    setMetrics({
      yesRepAvg: yesCount > 0 ? Math.round(yesRepTotal / yesCount) : 0,
      noRepAvg: noCount > 0 ? Math.round(noRepTotal / noCount) : 0,
      crowdYesPct: totalCount > 0 ? Math.round((yesCount / totalCount) * 100) : 50,
      totalVotes: totalCount
    });
  }

  async function saveVoteToSupabase() {
    if (!userAddress) return;

    try {
        await supabase.from('users').upsert(
          { wallet_address: userAddress, reputation_score: 100 }, 
          { onConflict: 'wallet_address', ignoreDuplicates: true }
        );
        
        const { data: user } = await supabase
          .from('users')
          .select('reputation_score')
          .eq('wallet_address', userAddress)
          .maybeSingle();
          
        const currentRep = user?.reputation_score || 100;

        // vote part
        await supabase.from('votes').insert({
          wallet_address: userAddress,
          market_id: market.id,
          choice: isVoting,
          weight_at_time: currentRep, 
          tx_hash: hash
        });

        setHasVoted(true);
        setIsVoting(null);
        fetchDetailedSentiment();
    } catch (err) {
        console.error("Supabase Error:", err);
        setIsVoting(null);
    }
  }

  const handleVote = async (choice: 'YES' | 'NO') => {
    if (isEnded) return alert("Market is Resolved");
    if (!userAddress) return alert("Please Connect Wallet");

    if (!chain || chain.id !== TARGET_CHAIN_ID) {
        try {
            switchChain({ chainId: TARGET_CHAIN_ID });
            return; 
        } catch (err) {
            console.error("Failed to switch network", err);
            return;
        }
    }

    setIsVoting(choice);
    
    try {
        await writeContractAsync({
          address: LAKUZO_CONTRACT_ADDRESS,
          abi: LAKUZO_ABI,
          functionName: 'castVote',
          args: [market.id, choice === 'YES'],
          chainId: TARGET_CHAIN_ID, 
        });
    } catch (err) {
        console.error("Transaction failed or rejected:", err);
        setIsVoting(null);
    }
  };

  // output

  const showResults = hasVoted || isEnded;

  if (!isReady) return <div className="animate-pulse h-20 bg-gray-900 rounded-xl"></div>;

  const totalRep = metrics.yesRepAvg + metrics.noRepAvg;
  const smartYesPct = totalRep > 0 ? (metrics.yesRepAvg / totalRep) * 100 : 50;

 
  if (isDetailView) {
    return (
      <div className="detail-voting-container">
        {showResults ? (
          <div className="reveal-dashboard fade-in">
             <div className="dashboard-header">
               <span className="dash-title">{isEnded ? '🏁 Final Sentiment' : '🗳️ Market Sentiment'}</span>
               <span className="dash-votes">{metrics.totalVotes} Community Votes</span>
             </div>

             <div className="dash-section">
                <div className="section-label-row">
                   <span className="lbl">🧠 Smart Money (Avg Rep)</span>
                   <span className="val">{metrics.yesRepAvg > metrics.noRepAvg ? 'Bullish' : 'Bearish'}</span>
                </div>
                <div className="tug-war-bar">
                   <div className="tug-segment yes" style={{ width: `${smartYesPct}%` }}>
                      <span className="segment-label">{metrics.yesRepAvg}</span>
                   </div>
                   <div className="tug-segment no" style={{ width: `${100 - smartYesPct}%` }}>
                      <span className="segment-label">{metrics.noRepAvg}</span>
                   </div>
                </div>
                <div className="tug-labels">
                   <span>YES Confidence</span>
                   <span>NO Confidence</span>
                </div>
             </div>

             <div className="dash-divider"></div>

             
             <div className="dash-section">
                <div className="section-label-row">
                   <span className="lbl">👥 The Crowd (Vote Count)</span>
                </div>
                <div className="crowd-bar-container">
                   <div className="crowd-fill" style={{ width: `${metrics.crowdYesPct}%` }}>
                      {metrics.crowdYesPct > 15 && <span className="fill-text">{metrics.crowdYesPct}% YES</span>}
                   </div>
                   {metrics.crowdYesPct < 85 && <span className="empty-text">{100 - metrics.crowdYesPct}% NO</span>}
                </div>
             </div>
          </div>
        ) : (
          <div className="voting-action-area">
             <h3 className="vote-prompt">Vote to Reveal Sentiment</h3>
             <div className="vote-buttons-large">
                <button onClick={() => handleVote('YES')} disabled={!!isVoting || isConfirming} className="vote-btn-hero yes">
                  {isVoting === 'YES' || isConfirming ? 'Signing...' : 'Vote YES'}
                </button>
                <button onClick={() => handleVote('NO')} disabled={!!isVoting || isConfirming} className="vote-btn-hero no">
                  {isVoting === 'NO' || isConfirming ? 'Signing...' : 'Vote NO'}
                </button>
             </div>
            
             {/* fallback error */}
            {writeError && (
                <div className="text-red-500 text-xs mt-2 text-center">
                    {writeError.message.includes("Chain mismatch") || writeError.message.includes("chain")
                        ? "⚠️ Wrong Network. Please switch to Base Mainnet." 
                        : "Transaction failed. Please try again."}
                </div>
             )}
             
             <p className="vote-sub">Voting is free (Gas Only) & builds Reputation</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="voting-card-row">
    </div>
  );
}
