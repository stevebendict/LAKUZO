'use client';

import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="app-header">
      {/* 1. Logo (Premium Text Gradient) */}
      <Link href="/" className="logo-text">
        LAKUZO
      </Link>
      
      {/* 2. Wallet Button (Contained) */}
      <div className="wallet-wrapper">
        <ConnectWallet className="cb-wallet-custom" />
      </div>
    </header>
  );
}
