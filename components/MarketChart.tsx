'use client';

import { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';

interface HistoryPoint { t: string; p: number; }

interface MarketChartProps {
  history: HistoryPoint[];
  currentPrice: number;
  isResolved?: boolean;
}

export default function MarketChart({ history, currentPrice, isResolved }: MarketChartProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [view, setView] = useState('ALL');
  const [color, setColor] = useState('#22c55e');

  useEffect(() => {
    const startPrice = history?.length > 0 ? history[0].p : currentPrice;
    const isPositive = currentPrice >= startPrice;
    setColor(isResolved ? '#888' : (isPositive ? '#22c55e' : '#ef4444'));

    if (!history) return;
    
    let formatted = history.map(point => ({
      time: new Date(point.t).getTime(),
      displayDate: new Date(point.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      displayTime: new Date(point.t).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }),
      price: point.p
    }));

    const now = new Date().getTime();
    if (view !== 'ALL') {
      let cutoff = 0;
      if (view === '1H') cutoff = now - (60 * 60 * 1000);
      if (view === '6H') cutoff = now - (6 * 60 * 60 * 1000);
      if (view === '1D') cutoff = now - (24 * 60 * 60 * 1000);
      if (view === '1W') cutoff = now - (7 * 24 * 60 * 60 * 1000);
      if (view === '1M') cutoff = now - (30 * 24 * 60 * 60 * 1000);
      
      formatted = formatted.filter(pt => pt.time >= cutoff);
    }

    formatted.push({
      time: now,
      displayDate: isResolved ? 'Final' : 'Live',
      displayTime: isResolved ? 'Closed' : 'Now',
      price: currentPrice
    });

    setChartData(formatted);
  }, [history, currentPrice, isResolved, view]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#111', border: '1px solid #333', padding: '8px', borderRadius: '4px', fontSize: '12px', zIndex: 100 }}>
          <div style={{ color: '#888' }}>{payload[0].payload.displayDate} • {payload[0].payload.displayTime}</div>
          <div style={{ color: color, fontWeight: 'bold', fontSize: '14px' }}>
            {(payload[0].value * 100).toFixed(1)}¢
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', userSelect: 'none' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px', padding: '0 4px' }}>
        <div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: color, lineHeight: '1' }}>
            {(currentPrice * 100).toFixed(1)}¢
          </div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: color, opacity: 0.8, marginTop: '4px' }}>
            {isResolved ? 'Market Resolved' : (view === 'ALL' ? 'All Time' : `Past ${view}`)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '8px' }}>
          {(['1H', '6H', '1D', '1W', '1M', 'ALL'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setView(r)}
              style={{
                background: view === r ? '#333' : 'transparent',
                color: view === r ? '#fff' : '#666',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                minWidth: '30px',
                transition: 'all 0.2s'
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* bagian chart */}
      <div style={{ width: '100%', height: '240px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid stroke="#222" vertical={false} strokeDasharray="3 3" />
            
            <XAxis 
              dataKey="time" 
              type="number" 
              domain={['dataMin', 'dataMax']} 
              tickFormatter={(unix) => {
                 const date = new Date(unix);
                 return ['1W', '1M', 'ALL'].includes(view) 
                    ? date.toLocaleDateString(undefined, {month:'short', day:'numeric'}) 
                    : date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
              }}
              hide={false}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
              style={{ fontSize: '10px', fill: '#555' }}
            />
            <YAxis domain={['auto', 'auto']} hide />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#444', strokeWidth: 1 }} />
            
            <Area 
              type="linear" 
              dataKey="price" 
              stroke={color} 
              strokeWidth={2} 
              fillOpacity={1} 
              fill="url(#colorPrice)" 
              isAnimationActive={true}
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
