export interface MarketData {
  id: string;
  platform: string;
  title: string;
  group_id?: string; // Critical for Kalshi (Series Ticker)
  external_id?: string;
  source_url?: string;
  best_ask_yes?: number | null;
  best_ask_no?: number | null;
  current_yes_price?: number;
  [key: string]: any; // Allow other DB fields
}

// 1. SMART URL BUILDER
// 1. SMART URL BUILDER
export function getMarketUrl(market: MarketData): string {
  if (!market) return '#';

  // KALSHI LOGIC (User Hypothesis Version)
  if (market.platform === 'Kalshi') {
    // 1. Get the best ID we have (Group ID is preferred, External ID is backup)
    const rawId = market.group_id || market.external_id;
    
    if (!rawId) return 'https://kalshi.com/markets';

    // 2. APPLY "FIRST DASH" RULE
    // We split the ID by the dash "-" and strictly take the first part.
    // Example: "KXNCAAF-26" -> ["KXNCAAF", "26"] -> Returns "KXNCAAF"
    // Example: "KXCBAGAME-25DEC..." -> ["KXCBAGAME", "25DEC..."] -> Returns "KXCBAGAME"
    const parts = rawId.split('-');
    if (parts.length > 0 && parts[0].length > 2) {
       return `https://kalshi.com/markets/${parts[0]}`;
    }

    // Fallback if there is no dash
    return `https://kalshi.com/markets/${rawId}`;
  }

  // POLYMARKET LOGIC
  if (market.platform === 'Polymarket') {
    if (market.source_url) return market.source_url;
    return `https://polymarket.com/event/${market.group_id || market.external_id}`; 
  }

  return market.source_url || '#';
}

// 2. ORDER BOOK NORMALIZER
export function getOrderBook(market: MarketData) {
  // A. Extract Prices (Prioritize "Best Ask" -> "Current Price" -> 0)
  let buyYes = market.best_ask_yes ?? market.current_yes_price ?? 0;
  let buyNo = market.best_ask_no;

  // B. Derive Missing Sides
  // If Buy No is missing, assume it's the complement of Buy Yes
  if (buyNo === undefined || buyNo === null) {
    buyNo = 1 - buyYes;
  }

  // C. Safety Clamping (Prevent < 0 or > 1)
  buyYes = Math.max(0, Math.min(1, buyYes));
  buyNo = Math.max(0, Math.min(1, buyNo));

  // D. Estimate Sell Prices (For UI Simulation)
  const sellYes = Math.max(0, buyYes - 0.01);
  const sellNo = Math.max(0, buyNo - 0.01);

  return { 
    buyYes, 
    buyNo, 
    sellYes, 
    sellNo 
  };
}
