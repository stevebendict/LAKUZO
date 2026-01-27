"use client";

import { ReactNode, useState } from "react";
import { base, baseSepolia } from "wagmi/chains";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, createConfig, WagmiProvider } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors"; 
import "@coinbase/onchainkit/styles.css";

const config = createConfig({
  chains: [base, baseSepolia], 
  connectors: [
    coinbaseWallet({
      appName: "Lakuzo",
    }),
    injected(), 
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

export function RootProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={base}
          config={{
            appearance: { 
              mode: "dark",
              theme: "midnight",
            },
            wallet: { 
              display: "modal", 
              preference: "all" 
            },
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
