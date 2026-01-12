'use client';

import { useRouter } from 'next/navigation';

interface MarketPairProps {
  pair: any;
}

export default function MarketPairCard({ pair }: MarketPairProps) {
  const router = useRouter();
  const { poly_id, kalshi_id, poly_yes, poly_no, kalshi_yes, kalshi_no, match_type } = pair;

  // --- LOGIC: Calculate Yield for Both Sides ---
  let row1, row2;

  if (match_type === 'Inverse') {
    // INVERSE: Poly Yes == Kalshi No.
    const cost1 = (poly_yes || 0) + (kalshi_yes || 0);
    const yield1 = cost1 < 1 ? ((1 - cost1) * 100).toFixed(1) : null;
    
    row1 = {
      label: "POLY YES + KALSHI YES",
      cost: cost1,
      yield: yield1
    };

    const cost2 = (poly_no || 0) + (kalshi_no || 0);
    const yield2 = cost2 < 1 ? ((1 - cost2) * 100).toFixed(1) : null;

    row2 = {
      label: "POLY NO + KALSHI NO",
      cost: cost2,
      yield: yield2
    };

  } else {
    // DIRECT: Poly Yes == Kalshi Yes.
    const cost1 = (poly_yes || 0) + (kalshi_no || 0);
    const yield1 = cost1 < 1 ? ((1 - cost1) * 100).toFixed(1) : null;

    row1 = {
      label: "POLY YES + KALSHI NO",
      cost: cost1,
      yield: yield1
    };

    const cost2 = (poly_no || 0) + (kalshi_yes || 0);
    const yield2 = cost2 < 1 ? ((1 - cost2) * 100).toFixed(1) : null;

    row2 = {
      label: "POLY NO + KALSHI YES",
      cost: cost2,
      yield: yield2
    };
  }

  const maxYield = Math.max(Number(row1.yield || 0), Number(row2.yield || 0));
  const hasYield = maxYield > 0;

  const handleAnalyze = () => {
    router.push(`/workspace?ids=${poly_id},${kalshi_id}`);
  };

  const RenderRow = ({ data }: { data: any }) => (
    <div className={`pair-row ${data.yield ? 'profitable' : ''}`}>
      <span className="pair-label">{data.label}</span>
      <div className="pair-data">
        <span className="pair-cost">Cost: ${data.cost.toFixed(2)}</span>
        {data.yield && (
          <span className="pair-yield">
            ⚡ {data.yield}%
          </span>
        )}
      </div>
    </div>
  );

  return (
    // Reusing your existing 'market-card-dark' class for consistency
    <div 
      onClick={handleAnalyze}
      className={`market-card-dark ${hasYield ? 'arb-glow-gold' : ''}`}
      style={{ borderRadius: '12px', padding: '16px', marginBottom: '16px' }} // Local override for card spacing
    >
      {/* "Impulsive" Badge using your existing class */}
      {hasYield && (
        <div className="arb-badge-gold">
          ARBITRAGE DETECTED
        </div>
      )}

      {/* HEADER: Image + Title using existing classes */}
      <div className="card-top">
        <img 
          src={pair.poly_image || '/placeholder_icon.png'} 
          alt="market icon" 
          className="market-icon"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        
        <div className="card-meta">
          <h3 className="market-title-dark">
            {pair.poly_title}
          </h3>
          
          <div style={{ marginTop: '6px' }}>
            {match_type === 'Inverse' && (
              <span className="pair-match-badge inverse-tag">
                🔄 INVERSE
              </span>
            )}
            <span className="pair-match-badge">
              {(pair.confidence_score * 100).toFixed(0)}% MATCH
            </span>
          </div>
        </div>
      </div>

      {/* ACTION ROWS (New CSS) */}
      <div style={{ marginTop: '12px' }}>
        <RenderRow data={row1} />
        <RenderRow data={row2} />
      </div>

      <div className="click-hint">
        Tap to Analyze →
      </div>
    </div>
  );
}
