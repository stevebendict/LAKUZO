'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabaseClient'; // Uses your shared client

const TARGET_CHAIN_ID = 8453; // Base Mainnet

export default function UserSync() {
  const { address, chain } = useAccount();

  useEffect(() => {
    const syncUser = async () => {
      // 1. Only run if connected to Base Mainnet
      if (!address || !chain || chain.id !== TARGET_CHAIN_ID) return;

      console.log("🔄 Syncing User to Database...");

      // 2. Upsert User (Silent Background Fix)
      const { error } = await supabase
        .from('users')
        .upsert(
          { wallet_address: address, reputation_score: 100 },
          { onConflict: 'wallet_address', ignoreDuplicates: true }
        );

      if (error) console.error("❌ Sync Failed:", error.message);
      else console.log("✅ User Synced:", address);
    };

    syncUser();
  }, [address, chain]);

  return null; // Invisible component
}
