'use client';

import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="app-header">
      <Link href="/" className="logo-text">
        LAKUZO
      </Link>
      
      <div className="wallet-wrapper">
        <ConnectWallet className="cb-wallet-custom" />
      </div>
    </header>
  );
}
