import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const platform = searchParams.get('platform'); 
  const externalId = searchParams.get('external_id'); 

  if (!id || !platform || !externalId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    let isResolved = false;
    let winner = null;
    let livePrice = null;

    if (platform === 'Polymarket') {
      const res = await fetch(`https://gamma-api.polymarket.com/markets/${externalId}`);
      if (res.ok) {
        const data = await res.json();
        
        if (data.closed || data.resolved) {
          isResolved = true;
          if (data.outcomePrices && data.outcomes) {
             try {
                 const outcomes = JSON.parse(data.outcomes);
                 const prices = JSON.parse(data.outcomePrices);
                 const winnerIndex = prices.findIndex((p: string) => parseFloat(p) >= 0.99);
                 if (winnerIndex !== -1) winner = outcomes[winnerIndex];
             } catch(e) { console.error("Parse error", e); }
          }
        } 
        else if (data.outcomePrices) {
           const prices = JSON.parse(data.outcomePrices);
           if (prices[0]) livePrice = parseFloat(prices[0]);
        }
      }
    } 
    else if (platform === 'Kalshi') {
      const res = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets/${externalId}`);
      if (res.ok) {
        const data = await res.json();
        const m = data.market;
        
        if (m && (m.status === 'finalized' || m.status === 'settled')) {
          isResolved = true;
          winner = m.result === 'yes' ? 'Yes' : 'No'; 
        } 
        else if (m && m.status === 'closed') {
          isResolved = true;
          winner = 'Pending'; 
        }
        else if (m) {
           livePrice = m.last_price ? m.last_price / 100 : (m.yes_ask ? m.yes_ask / 100 : null);
        }
      }
    }

    if (isResolved) {
      console.log(`⚡ Lazy Repair: ${id} is resolved. Winner: ${winner}`);
      
      const updatePayload: any = { 
        active: false, // 
        updated_at: new Date().toISOString()
      };
      
      if (winner) updatePayload.winning_outcome = winner;

      const { error } = await supabase
        .from('markets')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
          console.error("DB Update Failed:", error.message);
          return NextResponse.json({ updated: false, error: error.message });
      }

      return NextResponse.json({ updated: true, status: 'resolved', winner });
    }

    return NextResponse.json({ status: 'active', updated: false, livePrice });

  } catch (error) {
    console.error('Sweeper Error:', error);
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}
