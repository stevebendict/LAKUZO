'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface MarketChartProps {
  marketId: string;
  platform: string;
  currentPrice: number;
  timeRange?: '1D' | '1W' | '1M'; // Added prop
}

export default function MarketChart({ marketId, platform, currentPrice, timeRange = '1D' }: MarketChartProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    generateSyntheticData(currentPrice, timeRange);
  }, [marketId, currentPrice, timeRange]);

  const generateSyntheticData = (price: number, range: string) => {
    const points = [];
    let tempPrice = price;
    let iterations = 24; // Default 1D (Hours)
    let label = 'Time';

    // Configure loop based on Range
    if (range === '1W') iterations = 7; // Days
    if (range === '1M') iterations = 30; // Days

    for (let i = iterations; i >= 0; i--) {
      // More volatility for longer timeframes
      const volatility = range === '1D' ? 0.05 : 0.15; 
      const noise = (Math.random() - 0.5) * volatility; 
      
      tempPrice = Math.max(0.01, Math.min(0.99, tempPrice - noise));
      
      points.push({
        label: i === 0 ? 'Now' : `-${i}${range === '1D' ? 'h' : 'd'}`,
        price: tempPrice
      });
    }
    // Force exact current price at the end
    points[points.length - 1].price = price;
    setData(points);
  };

  return (
    <div style={{ width: '100%', height: 200, marginTop: 10 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis domain={[0, 1]} hide />
          <Tooltip 
            contentStyle={{ background: '#111', border: '1px solid #333' }}
            formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Probability']}
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorPrice)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
