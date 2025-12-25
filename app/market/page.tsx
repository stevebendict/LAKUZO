'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation'; // CHANGED
import { createClient } from '@supabase/supabase-js';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { LAKUZO_ABI } from '@/utils/abi';
import MarketChart from '@/components/MarketChart';

// CONFIG
const CONTRACT_ADDRESS = '0x4a5D74D83075C995ae4b8aE3c946c5f084896ae0';
const CHAIN_ID = 84532; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function MarketContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id'); // CHANGED: Get ID from ?id=...
  
  const { address, isConnected } = useAccount();
  const [market, setMarket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Vote State
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState<'YES' | 'NO' | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Watchlist State
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'1D' | '1W' | '1M'>('1D');

  // Metrics
  const [metrics, setMetrics] = useState({
    yesRepAvg: 0, noRepAvg: 0, crowdYesPct: 50, totalVotes: 0
  });

  const { data: hash, writeContract, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!id) return;
    async function init() {
      const { data } = await supabase.from('markets').select('*').eq('id', id).single();
      setMarket(data);
      if (data && !data.active) fetchSentimentData(data.id);
      if (address) checkUserStatus(address, id!, data?.active);
      setLoading(false);
    }
    init();
  }, [id, address]);

  async function checkUserStatus(userWallet: string, marketId: string, isActive: boolean) {
    const { data: vote } = await supabase.from('votes').select('id').eq('market_id', marketId).eq('wallet_address', userWallet).maybeSingle(); 
    if (vote) { setHasVoted(true); if (isActive) fetchSentimentData(marketId); }

    const { data: wlList } = await supabase.from('watchlists').select('id').ilike('user_wallet', userWallet).eq('name', 'My Watchlist').limit(1);
    if (wlList?.[0]?.id) {
      const { data: item } = await supabase.from('watchlist_items').select('*').eq('watchlist_id', wlList[0].id).eq('market_id', marketId).maybeSingle();
      if (item) setIsWatchlisted(true);
    }
  }

  async function fetchSentimentData(targetId = id!) {
    const { data: votes } = await supabase.from('votes').select('choice, weight_at_time').eq('market_id', targetId);
    if (!votes?.length) return;

    let yesRepTotal = 0, noRepTotal = 0, yesCount = 0, noCount = 0;
    votes.forEach(v => {
      if (v.choice === 'YES') { yesRepTotal += v.weight_at_time; yesCount++; }
      else { noRepTotal += v.weight_at_time; noCount++; }
    });
    const totalCount = yesCount + noCount;
    setMetrics({
      yesRepAvg: yesCount ? Math.round(yesRepTotal/yesCount) : 0,
      noRepAvg: noCount ? Math.round(noRepTotal/noCount) : 0,
      crowdYesPct: totalCount ? Math.round((yesCount/totalCount)*100) : 50,
      totalVotes: totalCount
    });
  }

  const toggleWatchlist = async () => {
    if (!address) return setShowLoginModal(true);
    setWatchlistLoading(true);
    await supabase.from('users').upsert({ wallet_address: address }, { onConflict: 'wallet_address', ignoreDuplicates: true });

    let { data: wlList } = await supabase.from('watchlists').select('id').ilike('user_wallet', address).eq('name', 'My Watchlist').limit(1);
    let wlId = wlList?.[0]?.id;
    if (!wlId) {
      const { data: newWl } = await supabase.from('watchlists').insert({ user_wallet: address, name: 'My Watchlist' }).select().single();
      wlId = newWl?.id;
    }

    if (isWatchlisted) {
      await supabase.from('watchlist_items').delete().eq('watchlist_id', wlId).eq('market_id', id);
      setIsWatchlisted(false);
    } else {
      await supabase.from('watchlist_items').insert({ watchlist_id: wlId, market_id: id });
      setIsWatchlisted(true);
    }
    setWatchlistLoading(false);
  };

  useEffect(() => {
    if (isConfirmed && isVoting && address && id) {
      const saveVote = async () => {
        if (!market.active) return alert("Voting ended.");
        const { data: user } = await supabase.from('users').select('reputation_score').eq('wallet_address', address).single();
        const currentRep = user?.reputation_score || 100;
        await supabase.from('votes').insert({ wallet_address: address, market_id: id, choice: isVoting, weight_at_time: currentRep, tx_hash: hash });
        setHasVoted(true); setIsVoting(null); setTimeout(() => fetchSentimentData(id!), 500);
      };
      saveVote();
    }
  }, [isConfirmed]);

  const handleVoteClick = (choice: 'YES' | 'NO') => {
    if (!market?.active || !id) return;
    if (!isConnected) return setShowLoginModal(true);
    setIsVoting(choice);
    writeContract({ address: CONTRACT_ADDRESS, abi: LAKUZO_ABI, functionName: 'castVote', args: [id, choice === 'YES'], chainId: CHAIN_ID });
  };

  if (loading || !market) return <div className="loading">Loading Market...</div>;

  const isEnded = !market.active;
  const endDateFormatted = market.end_date ? new Date(market.end_date).toLocaleDateString() : 'Unknown';
  const yesPrice = market.best_ask_yes ?? market.current_yes_price;
  const noPrice = market.best_ask_no ?? (market.current_yes_price ? 1 - market.current_yes_price : 0);
  const totalCost = (yesPrice || 0) + (noPrice || 0);
  const isArb = totalCost > 0 && totalCost < 0.99 && market.active;

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      {/* HEADER */}
      <div className={`market-header-v2 ${isArb ? 'arb-highlight' : ''}`} style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'15px'}}>
        <div style={{flex:1}}>
          <div className="title-group" style={{marginBottom:'10px'}}>
            <img src={market.image_url && !market.image_url.includes('default') ? market.image_url : '/placeholder.png'} className="market-icon-large" onError={(e) => e.currentTarget.style.display = 'none'} />
            <div>
              <h1 className="market-title-large">{market.title}</h1>
              <div style={{display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center'}}>
                <span className={`platform-badge ${market.platform.toLowerCase()}`}>{market.platform}</span>
                {isEnded ? <span className="status-badge ended">🔴 ENDED</span> : <span className="status-badge live" style={{color: '#22c55e', border: '1px solid #22c55e'}}>🟢 LIVE</span>}
                {isArb && <span className="arb-badge">⚡ ARB</span>}
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: '#888', marginTop: '6px', alignItems: 'center' }}>
                 <span>📅 Ends {new Date(market.end_date).toLocaleDateString()}</span>
                 <span style={{color:'#444'}}>|</span>
                 <a href={market.source_url} target="_blank" className="trade-link-simple">Trade on {market.platform} ↗</a>
              </div>
            </div>
          </div>
          <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
             <button className={`watchlist-btn ${isWatchlisted ? 'active' : ''}`} onClick={toggleWatchlist} disabled={watchlistLoading}>{isWatchlisted ? '★ Watch' : '☆ Watch'}</button>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px'}}>
           {isEnded ? (
             <div className={`winner-badge ${market.winning_outcome === 'YES' ? 'win-yes' : 'win-no'}`}>{market.winning_outcome ? `${market.winning_outcome} WON` : 'ENDED'}</div>
           ) : (
             <>
               <div className="price-badge yes" style={{fontSize:'14px', padding:'8px 12px', marginBottom:0}}>YES ${yesPrice?.toFixed(2) || '-'}</div>
               <div className="price-badge no" style={{fontSize:'14px', padding:'8px 12px', marginBottom:0}}>NO ${noPrice?.toFixed(2) || '-'}</div>
             </>
           )}
           <div style={{fontSize:'10px', color:'#888', marginTop:'4px'}}>Vol: ${Number(market.volume_usd).toLocaleString()}</div>
        </div>
      </div>

      {/* CHART */}
      <div className="chart-container" style={{marginTop:'20px'}}>
           <MarketChart marketId={market.id} platform={market.platform} currentPrice={market.current_yes_price} timeRange={timeRange} />
      </div>

      {/* VOTING */}
      <div className="action-area">
        {isEnded ? <div className="voted-banner" style={{borderColor: '#888', color: '#ccc', background: '#222'}}>🔒 Market ended.</div> : !hasVoted ? (
          <>
            <h3 className="prompt-text">Vote to Reveal Sentiment</h3>
            <div className="vote-buttons-row">
              <button className="vote-btn-large yes" onClick={() => handleVoteClick('YES')} disabled={isConfirming || isVoting !== null}>{isVoting === 'YES' ? 'Signing...' : 'Vote YES'}</button>
              <button className="vote-btn-large no" onClick={() => handleVoteClick('NO')} disabled={isConfirming || isVoting !== null}>{isVoting === 'NO' ? 'Signing...' : 'Vote NO'}</button>
            </div>
            {isConfirming && <div className="tx-loader">Confirming...</div>}
            {writeError && <div className="tx-error">Error: {writeError.message.split('.')[0]}</div>}
          </>
        ) : <div className="voted-banner">✅ Sentiment Revealed</div>}
      </div>

      {/* REVEAL */}
      {(hasVoted || isEnded) && (
        <div className="reveal-section fade-in">
          <div className="sentiment-grid-v2">
            <div className="sent-card">
               <div className="sent-header"><span className="icon">🧠</span> Smart Money</div>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'10px'}}>
                 <div style={{textAlign:'center'}}><div style={{fontSize:'20px', fontWeight:'bold', color:'#22c55e'}}>{metrics.yesRepAvg}</div><div style={{fontSize:'9px', color:'#666'}}>AVG YES REP</div></div>
                 <div style={{fontSize:'12px', color:'#444', paddingBottom:'5px'}}>VS</div>
                 <div style={{textAlign:'center'}}><div style={{fontSize:'20px', fontWeight:'bold', color:'#ef4444'}}>{metrics.noRepAvg}</div><div style={{fontSize:'9px', color:'#666'}}>AVG NO REP</div></div>
               </div>
               <div className="rep-avg-row">Weighted by Trader Reputation</div>
            </div>
            <div className="sent-card">
               <div className="sent-header"><span className="icon">👥</span> The Crowd</div>
               <div className="sent-big-val">{metrics.crowdYesPct}% YES</div>
               <div className="sent-bar-container"><div className="sent-bar-fill crowd" style={{width: `${metrics.crowdYesPct}%`}}></div></div>
               <div className="rep-avg-row">Based on {metrics.totalVotes} votes</div>
            </div>
          </div>
        </div>
      )}

      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Connect Wallet</h3><p>Please connect to interact.</p>
            <div className="modal-action"><ConnectWallet /></div>
            <button className="close-btn" onClick={() => setShowLoginModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// WRAPPER FOR SUSPENSE (Required for useSearchParams)
export default function MarketPage() {
  return (
    <Suspense fallback={<div className="loading">Loading Market...</div>}>
      <MarketContent />
    </Suspense>
  );
}
