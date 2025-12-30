'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';

export default function SubscriptionPage() {
  const { address, isConnected } = useAccount();
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');
  const [isProcessing, setIsProcessing] = useState(false);

  // MOCK PAYMENT HANDLER
  const handleSubscribe = async () => {
    if (!isConnected) return alert("Please connect your wallet first.");
    
    setIsProcessing(true);
    
    // Simulation of USDT Approval + Transfer
    setTimeout(() => {
        const amount = billingCycle === 'MONTHLY' ? '20 USDT' : '200 USDT';
        alert(`🚀 Payment Successful!\n\nYou subscribed to PRO (${amount}).\nWelcome to the elite circle.`);
        setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="mobile-container-dark" style={{ paddingBottom: '120px' }}>
      
      {/* 1. HERO SECTION */}
      <div className="pro-hero">
         <div className="pro-badge-top">LAKUZO PRO</div>
         <h1 className="pro-headline">Trade Smarter.<br/>Win Bigger.</h1>
         <p className="pro-subhead">
            Unlock professional tools, real-time arbitrage alerts, and whale tracking.
         </p>
      </div>

      {/* 2. TOGGLE SWITCH */}
      <div className="billing-toggle-container">
         <div className="billing-toggle-bg">
            <button 
              className={`toggle-option ${billingCycle === 'MONTHLY' ? 'active' : ''}`}
              onClick={() => setBillingCycle('MONTHLY')}
            >
              Monthly
            </button>
            <button 
              className={`toggle-option ${billingCycle === 'YEARLY' ? 'active' : ''}`}
              onClick={() => setBillingCycle('YEARLY')}
            >
              Yearly <span className="save-tag">SAVE 17%</span>
            </button>
         </div>
      </div>

      {/* 3. PRICING CARD */}
      <div className="pro-price-card">
         <div className="price-stack">
            <span className="currency">$</span>
            <span className="amount">{billingCycle === 'MONTHLY' ? '20' : '200'}</span>
            <span className="period">/{billingCycle === 'MONTHLY' ? 'mo' : 'yr'}</span>
         </div>
         <div className="price-sub">Paid in USDT or USDC on Base</div>
      </div>

      {/* 4. FEATURE LIST (Value Stack) */}
      <div className="feature-list">
         <FeatureItem 
           icon="⚡" 
           title="Arbitrage Scanner" 
           desc="Instant alerts when Poly vs Kalshi price gaps exceed 5%." 
         />
         <FeatureItem 
           icon="🐋" 
           title="Whale Watch" 
           desc="See real-time votes from Top 10 Reputation traders." 
         />
         <FeatureItem 
           icon="♾️" 
           title="Unlimited Bundles" 
           desc="Create unlimited Analysis Workspaces (Free plan limited to 3)." 
         />
         <FeatureItem 
           icon="🔒" 
           title="Private Mode" 
           desc="Hide your 'Saved Markets' from public view." 
         />
         <FeatureItem 
           icon="👑" 
           title="Gold Badge" 
           desc="Stand out on the Leaderboard with a PRO badge." 
         />
      </div>

      {/* 5. STICKY CTA */}
      <div className="sticky-pro-cta">
        {!isConnected ? (
          // VARIATION: Full-width Connect Button for Footer
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <ConnectWallet className="cb-wallet-custom" />
              <p className="cancel-text">Connect your wallet to proceed with payment</p>
          </div>
        ) : (
          <>
            <button 
              className="btn-pro-subscribe"
              onClick={handleSubscribe}
              disabled={isProcessing}
            >
              {isProcessing ? 'Confirming Transaction...' : `Subscribe for $${billingCycle === 'MONTHLY' ? '20' : '200'}`}
            </button>
            <p className="cancel-text">Cancel anytime. Secure on-chain payment.</p>
          </>
        )}
      </div>

    </div>
  );
}

// --- HELPER COMPONENT (Outside the main function) ---
function FeatureItem({ icon, title, desc }: { icon: string, title: string, desc: string }) {
    return (
        <div className="feature-row">
            <div className="feature-icon">{icon}</div>
            <div className="feature-text">
                <h3>{title}</h3>
                <p>{desc}</p>
            </div>
        </div>
    );
}
