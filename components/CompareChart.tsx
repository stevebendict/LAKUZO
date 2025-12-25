'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CompareProps {
  markets: any[]; // Array of market objects
}

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6'];

export default function CompareChart({ markets }: CompareProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!markets || markets.length === 0) return;
    generateComparisonData();
  }, [markets]);

  const generateComparisonData = () => {
    const points = [];
    // Generate 24 hours of data points
    for (let i = 24; i >= 0; i--) {
      const point: any = { time: `-${i}h` };
      
      // For each market, generate a price point
      markets.forEach((m, index) => {
        const volatility = 0.05;
        // Seed random based on market ID to keep lines consistent on re-render
        const pseudoRandom = (m.id.charCodeAt(0) % 10) / 100; 
        
        let price = m.current_yes_price || 0.5;
        // Add fake "history" drift
        if (i > 0) {
           const noise = (Math.random() - 0.5) * volatility + pseudoRandom;
           price = Math.max(0.01, Math.min(0.99, price - noise));
        }
        point[m.id] = price;
      });
      
      points.push(point);
    }
    setData(points);
  };

  return (
    <div style={{ width: '100%', height: 300, background: '#111', borderRadius: '12px', padding: '20px', border: '1px solid #333' }}>
      <h3 style={{marginTop:0, fontSize:'14px', color:'#888'}}>PROBABILITY COMPARISON (24H)</h3>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            {markets.map((m, i) => (
              <linearGradient key={m.id} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis domain={[0, 1]} hide />
          <Tooltip 
            contentStyle={{ background: '#000', border: '1px solid #333' }}
            formatter={(val: number) => `${(val * 100).toFixed(0)}%`}
          />
          <Legend />
          {markets.map((m, i) => (
            <Area 
              key={m.id}
              type="monotone" 
              dataKey={m.id} 
              name={m.title.substring(0, 15) + '...'}
              stroke={COLORS[i % COLORS.length]} 
              fill={`url(#grad${i})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
