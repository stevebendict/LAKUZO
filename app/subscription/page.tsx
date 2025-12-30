'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
// Import the constants we created earlier
import { LAKUZO_CONTRACT_ADDRESS, LAKUZO_ABI } from '@/utils/constants';

export default function SubscriptionPage() {
  const { isConnected } = useAccount();
  // Changed 'YEARLY' to 'ANNUAL' to match smart contract logic
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL');

  // Wagmi Write Hook
  const { data: hash, writeContract, isPending } = useWriteContract();

  // Wait for Transaction Receipt (Loading State)
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash 
  });

  const handleSubscribe = async () => {
    if (!isConnected) return;

    // 1. Set Exact ETH Price (Must match contract constants)
    // Monthly: 0.006 ETH (~$20), Annual: 0.06 ETH (~$200)
    const price = billingCycle === 'MONTHLY' ? '0.006' : '0.06';

    try {
      writeContract({
        address: LAKUZO_CONTRACT_ADDRESS,
        abi: LAKUZO_ABI,
        functionName: billingCycle === 'MONTHLY' ? 'subscribeMonthly' : 'subscribeAnnually',
        value: parseEther(price), 
        chainId: 8453, // Force Base Mainnet
      });
    } catch (error) {
      console.error("Payment failed:", error);
    }
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
              className={`toggle-option ${billingCycle === 'ANNUAL' ? 'active' : ''}`}
              onClick={() => setBillingCycle('ANNUAL')}
            >
              Yearly <span className="save-tag">SAVE 17%</span>
            </button>
         </div>
      </div>

      {/* 3. PRICING CARD */}
      <div className="pro-price-card">
         <div className="price-stack">
            <span className="currency">Ξ</span>
            {/* Show ETH price instead of Dollar */}
            <span className="amount">{billingCycle === 'MONTHLY' ? '0.006' : '0.06'}</span>
            <span className="period">/{billingCycle === 'MONTHLY' ? 'mo' : 'yr'}</span>
         </div>
         <div className="price-sub">
            {billingCycle === 'MONTHLY' ? '≈ $20.00 USD' : '≈ $200.00 USD'} on Base
         </div>
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
        {isSuccess && (
            <div className="p-4 mb-4 bg-green-900/30 border border-green-500 rounded-lg text-green-400 text-center text-sm font-bold animate-pulse">
              🎉 Transaction Confirmed! Welcome to the elite circle.
            </div>
        )}

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
              disabled={isPending || isConfirming}
            >
              {isPending 
                ? 'Check Wallet...' 
                : isConfirming 
                  ? 'Confirming Transaction...' 
                  : `Subscribe for ${billingCycle === 'MONTHLY' ? '0.006 ETH' : '0.06 ETH'}`
              }
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
