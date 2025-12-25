'use client';

import MarketList from '../components/MarketList';

export default function Home() {
  return (
    <div className="container">
      {/* Header is gone (it's now in Layout) */}
      
      {/* Main Content Only */}
      <MarketList />
    </div>
  );
}
