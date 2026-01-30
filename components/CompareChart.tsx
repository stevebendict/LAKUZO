'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

interface CompareProps {
  markets: any[];
}

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function CompareChart({ markets }: CompareProps) {
  const [data, setData] = useState<any[]>([]);
  const [view, setView] = useState('ALL'); 

  useEffect(() => {
    if (!markets || markets.length === 0) return;
    processHistoryData();
  }, [markets, view]);

  const processHistoryData = () => {
    const now = new Date().getTime();
    
   
    let startTime = now - (24 * 60 * 60 * 1000); 
    if (view === '1H') startTime = now - (60 * 60 * 1000);
    if (view === '6H') startTime = now - (6 * 60 * 60 * 1000);
    if (view === '1D') startTime = now - (24 * 60 * 60 * 1000);
    if (view === '1W') startTime = now - (7 * 24 * 60 * 60 * 1000);
    if (view === '1M') startTime = now - (30 * 24 * 60 * 60 * 1000);
    if (view === 'ALL') startTime = now - (90 * 24 * 60 * 60 * 1000); 

 
    const buckets: any[] = [];
    const steps = 50; 
    const interval = (now - startTime) / steps;

    for (let t = startTime; t <= now; t += interval) {
      const point: any = { 
        time: t,
        displayTime: view === '1H' || view === '6H' || view === '1D' 
          ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })
          : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      };

     
      markets.forEach((m) => {
        let price = m.current_yes_price || 0; 

        if (t < now && m.price_history_7d && Array.isArray(m.price_history_7d)) {
           const history = m.price_history_7d;
           const relevantPoint = history.filter((h: any) => new Date(h.t).getTime() <= t).pop();
           
           if (relevantPoint) price = relevantPoint.p;
           else if (new Date(history[0]?.t).getTime() > t) price = null;
        }
        
      
        if (price !== null) point[m.id] = price;
      });

      buckets.push(point);
    }
    
   
    const finalPoint: any = { 
      time: now, 
      displayTime: 'Now' 
    };
    markets.forEach(m => finalPoint[m.id] = m.current_yes_price || m.best_ask_yes);
    buckets.push(finalPoint);

    setData(buckets);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#111', border: '1px solid #333', padding: '12px', borderRadius: '8px', fontSize: '12px', zIndex: 100 }}>
          <div style={{ color: '#888', marginBottom: '8px' }}>{payload[0].payload.displayTime}</div>
          {payload.map((entry: any, i: number) => (
            <div key={i} style={{ color: entry.color, fontWeight: 'bold', marginBottom: '4px' }}>
              {entry.name}: {(entry.value * 100).toFixed(1)}¢
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', padding: '16px', border: '1px solid #222' }}>
      
    
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin:0, fontSize:'12px', color:'#666', letterSpacing:'1px', textTransform:'uppercase' }}>
          Performance Comparison
        </h3>
        
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

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              {markets.map((m, i) => (
                <linearGradient key={m.id} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}/>
                </linearGradient>
              ))}
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
              tick={{ fontSize: 10, fill: '#555' }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis domain={[0, 1]} hide />
            
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#444' }} />
            
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}/>

            {markets.map((m, i) => (
              <Area 
                key={m.id}
                type="linear" 
                dataKey={m.id} 
                name={m.title.length > 20 ? m.title.substring(0, 20) + '...' : m.title}
                stroke={COLORS[i % COLORS.length]} 
                fill={`url(#grad${i})`}
                strokeWidth={2}
                connectNulls={true}
                isAnimationActive={false} 
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
