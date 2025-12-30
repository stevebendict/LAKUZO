import type { Metadata, Viewport } from "next";
import '@coinbase/onchainkit/styles.css';
import { Inter, Source_Code_Pro } from "next/font/google";
import { RootProvider } from "./rootProvider";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import UserSync from "@/components/UserSync";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sourceCodePro = Source_Code_Pro({ variable: "--font-source-code-pro", subsets: ["latin"] });

// 1. Set Base URL (Defaults to lakuzo.com if env var is missing)
const baseUrl = process.env.NEXT_PUBLIC_URL 
  ? `https://${process.env.NEXT_PUBLIC_URL}` 
  : 'https://lakuzo.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  
  // 2. Title Template
  title: {
    default: "Lakuzo | The Prediction Market Aggregator",
    template: "%s | Lakuzo",
  },
  
  description: "Track, trade, and analyze markets from Kalshi and Polymarket in one unified dashboard. Spot arbitrage opportunities and build your reputation on-chain.",
  
  applicationName: "Lakuzo",
  authors: [{ name: "Lakuzo Team", url: baseUrl }],
  keywords: ["Prediction Markets", "Polymarket", "Kalshi", "Arbitrage", "Crypto Betting", "Forecasting", "Base", "Ethereum"],
  
  // 3. OpenGraph (Social Sharing)
  openGraph: {
    title: "Lakuzo - Trade Every Market. One Interface.",
    description: "Compare odds across Polymarket & Kalshi. Find arbitrage instantly.",
    url: baseUrl,
    siteName: "Lakuzo",
    images: [
      {
        url: "/og-image.png", // Must be in public/og-image.png
        width: 1200,
        height: 630,
        alt: "Lakuzo Dashboard Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  // 4. Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "Lakuzo | Prediction Market Aggregator",
    description: "Don't just bet. Win. Live arbitrage scanner for Polymarket and Kalshi.",
    images: ["/og-image.png"],
    creator: "@lakuzoapp", // ✅ Updated
    site: "@lakuzoapp",
  },

  // 5. Icons
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png", 
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sourceCodePro.variable}`}>
        <RootProvider>
<UserSync />
          <Header />
          <main style={{ paddingBottom: '100px', paddingTop: '0px', minHeight: '100vh' }}>
            {children}
          </main>
          <BottomNav />
        </RootProvider>
       
      </body>
    </html>
  );
}
