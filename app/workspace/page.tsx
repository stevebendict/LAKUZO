'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useAccount } from 'wagmi';
import CompareChart from '@/components/CompareChart';
import MarketVotingCard from '@/components/MarketVotingCard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { address } = useAccount();

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [markets, setMarkets] = useState<any[]>([]);
  
  // Bundle Metadata
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [bundleName, setBundleName] = useState('');
  const [description, setDescription] = useState('');
  const [creator, setCreator] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  // Permissions & Modes
  const [isOwner, setIsOwner] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. INITIAL FETCH
  useEffect(() => {
    const idParam = searchParams.get('id');       // Viewing existing bundle
    const marketsParam = searchParams.get('markets'); // Creating new from selection

    async function init() {
      // SCENARIO A: VIEWING EXISTING BUNDLE
      if (idParam) {
        setBundleId(idParam);
        
        // Fetch Watchlist + Items + Markets + Creator Profile
        const { data: wl } = await supabase
          .from('watchlists')
          .select(`
            *,
            watchlist_items(market_id),
            users:user_wallet (username, wallet_address) 
          `)
          .eq('id', idParam)
          .single();

        if (wl) {
          setBundleName(wl.name);
          setDescription(wl.description || '');
          setCreatedAt(new Date(wl.created_at).toLocaleDateString());
          
          // Set Creator Name
          const creatorProfile = Array.isArray(wl.users) ? wl.users[0] : wl.users;
          setCreator(creatorProfile?.username || creatorProfile?.wallet_address || wl.user_wallet);

          // Check Ownership
          if (address && wl.user_wallet.toLowerCase() === address.toLowerCase()) {
            setIsOwner(true);
          }

          // Fetch Markets
          const marketIds = wl.watchlist_items.map((i: any) => i.market_id);
          if (marketIds.length > 0) {
            const { data: mData } = await supabase.from('markets').select('*').in('id', marketIds);
            setMarkets(mData || []);
          }
        }
      } 
      
      // SCENARIO B: CREATING NEW (Draft Mode)
      else if (marketsParam) {
        setIsEditing(true); // Default to edit mode for new bundles
        setIsOwner(true);   // You own what you're creating
        const ids = marketsParam.split(',');
        const { data } = await supabase.from('markets').select('*').in('id', ids);
        setMarkets(data || []);
      }
      
      setLoading(false);
    }

    init();
  }, [searchParams, address]);

  // --- ACTIONS ---

  // 1. SAVE CHANGES (Update or Create)
  const handleSave = async () => {
    if (!address) return alert("Connect wallet to save.");
    if (!bundleName.trim()) return alert("Bundle name is required.");
    setIsSaving(true);

    try {
      let targetId = bundleId;

      // UPDATE EXISTING
      if (bundleId) {
        await supabase
          .from('watchlists')
          .update({ name: bundleName, description: description })
          .eq('id', bundleId);
      } 
      // CREATE NEW
      else {
        // Anti-Duplicate Name Logic
        let finalName = bundleName;
        let counter = 1;
        let isUnique = false;
        while (!isUnique) {
          const { data } = await supabase.from('watchlists').select('id').ilike('user_wallet', address).eq('name', finalName).maybeSingle();
          if (!data) isUnique = true;
          else { finalName = `${bundleName} (${counter})`; counter++; }
        }

        const { data: newWl } = await supabase
          .from('watchlists')
          .insert({ user_wallet: address, name: finalName, description: description })
          .select()
          .single();
        
        if (newWl) {
          targetId = newWl.id;
          const items = markets.map(m => ({ watchlist_id: newWl.id, market_id: m.id }));
          await supabase.from('watchlist_items').insert(items);
          
          // Switch URL to the new ID so it becomes a "Real" bundle
          router.replace(`/workspace?id=${newWl.id}`);
          setBundleId(newWl.id);
        }
      }

      setIsEditing(false);
      alert("✅ Bundle saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Error saving bundle.");
    }
    setIsSaving(false);
  };

  // 2. REMOVE MARKET FROM BUNDLE
  const handleRemoveMarket = async (marketId: string) => {
    if (!confirm("Remove this market from the bundle?")) return;
    
    // UI Update
    setMarkets(prev => prev.filter(m => m.id !== marketId));

    // DB Update (Only if it's a real bundle)
    if (bundleId) {
      await supabase
        .from('watchlist_items')
        .delete()
        .eq('watchlist_id', bundleId)
        .eq('market_id', marketId);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("🔗 Copied Bundle Link: " + url);
  };

  if (loading) return <div className="loading">Loading Workspace...</div>;

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      
      {/* HEADER SECTION */}
      <div className="workspace-header-v2">
        <div className="ws-meta-row">
           <span className="ws-label">BUNDLE WORKSPACE</span>
           {createdAt && <span className="ws-date">Created {createdAt}</span>}
        </div>

        {/* TITLE & DESCRIPTION EDITOR */}
        {isEditing ? (
          <div className="editor-box">
             <input 
               className="edit-title" 
               value={bundleName} 
               onChange={e => setBundleName(e.target.value)} 
               placeholder="Bundle Name"
             />
             <textarea 
               className="edit-desc" 
               value={description} 
               onChange={e => setDescription(e.target.value)} 
               placeholder="Add a curator note (e.g. 'My bearish thesis for 2025...')"
             />
             <div className="edit-actions">
                <button onClick={() => setIsEditing(false)} className="btn-cancel">Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="btn-save">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
             </div>
          </div>
        ) : (
          <div className="display-box">
             <h1 className="ws-title">{bundleName}</h1>
             {description && <p className="ws-desc">"{description}"</p>}
             
             <div className="ws-curator">
                <span>Curated by <span className="text-blue">{creator || 'Unknown'}</span></span>
             </div>

             <div className="ws-controls">
                <button onClick={handleShare} className="control-btn">🔗 Share</button>
                {isOwner && (
                  <button onClick={() => setIsEditing(true)} className="control-btn edit">✎ Edit Bundle</button>
                )}
             </div>
          </div>
        )}
      </div>

      {/* CHART SECTION */}
      <div className="mb-8">
        <CompareChart markets={markets} />
      </div>

      {/* MARKET LIST SECTION */}
      <h3 className="section-title">Included Markets ({markets.length})</h3>
      <div className="market-list-stack">
        {markets.length === 0 ? (
           <div className="empty-state">No markets in this bundle.</div>
        ) : (
           markets.map(m => (
             <div key={m.id} className="relative-wrapper">
                <MarketVotingCard market={m} userAddress={address} />
                
                {/* REMOVE BUTTON (Only visible in Edit Mode) */}
                {isEditing && (
                  <button 
                    className="delete-item-btn"
                    onClick={() => handleRemoveMarket(m.id)}
                  >
                    Remove
                  </button>
                )}
             </div>
           ))
        )}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
    return (
        <Suspense fallback={<div className="loading">Loading...</div>}>
            <WorkspaceContent />
        </Suspense>
    )
}
