'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { SelectionGrid } from '@/components/SelectionGrid';
import { TotalsSummary } from '@/components/TotalsSummary';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Item {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Claim {
  shareId: string;
  itemId: string;
  portion: number;
}

interface Share {
  id: string;
  name: string;
  claims: Claim[];
}

interface Bill {
  id: string;
  name: string;
  createdAt: string;
  locked: boolean;
  items: Item[];
  shares: Share[];
  taxAmount: number;
  tipAmount: number;
  subtotal: number;
  total: number;
}

interface PersonTotal {
  shareId: string;
  name: string;
  itemsTotal: number;
  taxShare: number;
  tipShare: number;
  grandTotal: number;
  itemBreakdown: {
    itemId: string;
    itemName: string;
    itemPrice: number;
    portion: number;
    amountOwed: number;
    sharedWith: number;
  }[];
}

interface SplitsData {
  splits: PersonTotal[];
  summary: {
    totalClaimed: number;
    unclaimed: number;
  };
}

export default function BillPage() {
  const params = useParams();
  const billId = params.id as string;
  
  const [bill, setBill] = useState<Bill | null>(null);
  const [splits, setSplits] = useState<SplitsData | null>(null);
  const [currentShareId, setCurrentShareId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  // Flatten claims from shares
  const allClaims: Claim[] = bill?.shares.flatMap(share => 
    share.claims.map(claim => ({
      shareId: share.id,
      itemId: claim.itemId,
      portion: claim.portion,
    }))
  ) || [];

  const fetchBill = useCallback(async () => {
    try {
      const response = await fetch(`/api/bills/${billId}`);
      if (!response.ok) throw new Error('Failed to fetch bill');
      const data = await response.json();
      setBill(data);
      
      // If user hasn't joined yet, show dialog
      if (data.shares.length === 0) {
        setShowJoinDialog(true);
      }
    } catch (error) {
      console.error('Error fetching bill:', error);
      toast.error('Failed to load bill');
    }
  }, [billId]);

  const fetchSplits = useCallback(async () => {
    try {
      const response = await fetch(`/api/bills/${billId}/calculate`);
      if (!response.ok) throw new Error('Failed to calculate splits');
      const data = await response.json();
      setSplits(data);
    } catch (error) {
      console.error('Error calculating splits:', error);
    }
  }, [billId]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchBill();
      await fetchSplits();
      setIsLoading(false);
    };
    loadData();
  }, [fetchBill, fetchSplits]);

  const handleAddShare = async (name: string) => {
    try {
      const response = await fetch(`/api/bills/${billId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add person');
      }
      
      const newShare = await response.json();
      
      // Close dialog and clear input first
      setShowJoinDialog(false);
      setNewPersonName('');
      
      // Fetch updated bill data
      await fetchBill();
      
      // Set current share to the new person AFTER bill is updated
      // This ensures the new person's empty claims are properly reflected
      setCurrentShareId(newShare.id);
      
      toast.success(`${name} joined the bill!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add person');
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const response = await fetch(`/api/bills/${billId}/shares?shareId=${shareId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to remove person');
      
      if (currentShareId === shareId) {
        setCurrentShareId(null);
      }
      await fetchBill();
      await fetchSplits();
      toast.success('Person removed');
    } catch (error) {
      toast.error('Failed to remove person');
    }
  };

  const handleClaimChange = async (shareId: string, itemId: string, portion: number) => {
    try {
      if (portion === 0) {
        // Remove claim
        await fetch(`/api/bills/${billId}/claims?shareId=${shareId}&itemId=${itemId}`, {
          method: 'DELETE',
        });
      } else {
        // Add/update claim
        await fetch(`/api/bills/${billId}/claims`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareId, itemId, portion }),
        });
      }
      
      await fetchBill();
      await fetchSplits();
    } catch (error) {
      toast.error('Failed to update selection');
    }
  };

  const handleLockBill = async () => {
    try {
      await fetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: true }),
      });
      await fetchBill();
      toast.success('Bill locked! Selections can no longer be changed.');
    } catch (error) {
      toast.error('Failed to lock bill');
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading bill...</p>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 bg-zinc-900/50 border-zinc-800 text-center">
          <h2 className="text-xl font-semibold mb-2">Bill Not Found</h2>
          <p className="text-zinc-400 mb-4">This bill may have been deleted or the link is incorrect.</p>
          <Link href="/">
            <Button className="bg-emerald-600 hover:bg-emerald-700">Go Home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-800/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <span className="text-lg font-bold">F</span>
            </div>
            <span className="text-xl font-semibold">FairShare</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={copyShareLink}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </Button>
            {!bill.locked && (
              <Button variant="outline" size="sm" onClick={handleLockBill} className="border-zinc-700">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Lock Bill
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Bill Info */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">{bill.name}</h1>
            {bill.locked && (
              <Badge variant="outline" className="border-amber-500 text-amber-400">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Locked
              </Badge>
            )}
          </div>
          <p className="text-zinc-500">
            Created {new Date(bill.createdAt).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: Item Selection */}
          <div className="lg:col-span-3 space-y-6">
            {/* Current User Selector */}
            {bill.shares.length > 0 && !bill.locked && (
              <Card className="p-4 bg-zinc-900/50 border-zinc-800">
                <label className="block text-sm text-zinc-400 mb-3">I am:</label>
                <div className="flex flex-wrap gap-2">
                  {bill.shares.map((share) => (
                    <Button
                      key={share.id}
                      variant={currentShareId === share.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentShareId(share.id)}
                      className={currentShareId === share.id 
                        ? 'bg-emerald-600 hover:bg-emerald-700' 
                        : 'border-zinc-700'
                      }
                    >
                      {share.name}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowJoinDialog(true)}
                    className="border-dashed border-zinc-700"
                  >
                    + Join
                  </Button>
                </div>
              </Card>
            )}

            {/* Items */}
            <SelectionGrid
              items={bill.items}
              shares={bill.shares}
              claims={allClaims}
              currentShareId={currentShareId}
              onClaimChange={handleClaimChange}
              onAddShare={handleAddShare}
              onRemoveShare={handleRemoveShare}
              isLocked={bill.locked}
            />
          </div>

          {/* Right: Totals Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <h2 className="text-lg font-semibold mb-4">Split Summary</h2>
              <TotalsSummary
                splits={splits?.splits || []}
                billTotal={bill.total}
                highlightShareId={currentShareId}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Join Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Join this bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Enter your name to start selecting items
            </p>
            <Input
              placeholder="Your name..."
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newPersonName.trim()) {
                  handleAddShare(newPersonName.trim());
                }
              }}
              className="bg-zinc-800 border-zinc-700"
              autoFocus
            />
            <Button
              onClick={() => newPersonName.trim() && handleAddShare(newPersonName.trim())}
              disabled={!newPersonName.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              Join Bill
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

