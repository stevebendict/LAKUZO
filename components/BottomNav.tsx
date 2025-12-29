'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  // Helper to check active state
  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bottom-nav">
{/* 1. DASHBOARD */}
      <Link href="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span>Dashboard</span>
      </Link>      


{/* 2. EXPLORE (Home) */}
      <Link href="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
        </svg>
        <span>Explore</span>
      </Link>

      

      {/* 3. LEADERBOARD */}
      <Link href="/leaderboard" className={`nav-item ${isActive('/leaderboard') ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
          <path d="M4 22h16"/>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
        </svg>
        <span>Rank</span>
      </Link>

      {/* 4. SUBSCRIPTION (PRO) */}
      <Link href="/subscription" className={`nav-item ${isActive('/subscription') ? 'active' : ''}`}>
        {/* Crown Icon */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
           <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>
        </svg>
        <span>PRO</span>
      </Link>
    </nav>
  );
}
