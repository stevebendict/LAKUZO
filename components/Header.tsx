'use client';

import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="header">
      {/* 1. Logo (Changed div to Link so it clicks to Home) */}
      <Link href="/" className="logo">
        LAKUZO
      </Link>
      
      {/* 2. The Wallet Button (Moved exactly as is) */}
      <div>
        <ConnectWallet />
      </div>
    </header>
  );
}
