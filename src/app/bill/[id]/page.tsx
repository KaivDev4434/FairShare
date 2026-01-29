'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { SelectionGrid } from '@/components/SelectionGrid';
import { TotalsSummary } from '@/components/TotalsSummary';
import { UserMenu } from '@/components/UserMenu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// Debounce helper
function useDebounce<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  parent?: {
    id: string;
    name: string;
    slug: string;
    color?: string | null;
  } | null;
}

interface Item {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: Category | null;
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
  amountPaid: number;
  userId?: string | null;
}

interface Bill {
  id: string;
  name: string;
  createdAt: string;
  locked: boolean;
  requiresAuth: boolean;
  items: Item[];
  shares: Share[];
  taxAmount: number;
  tipAmount: number;
  subtotal: number;
  total: number;
  userId?: string | null;
  isCreator?: boolean;
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

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

interface SplitsData {
  splits: PersonTotal[];
  settlements?: Settlement[];
  summary: {
    totalClaimed: number;
    unclaimed: number;
  };
}

export default function BillPage() {
  const params = useParams();
  const { data: session, status: authStatus } = useSession();
  const billId = params.id as string;
  
  const [bill, setBill] = useState<Bill | null>(null);
  const [splits, setSplits] = useState<SplitsData | null>(null);
  const [currentShareId, setCurrentShareId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [showRemoveConfirmDialog, setShowRemoveConfirmDialog] = useState<{ id: string; name: string } | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  // Optimistic updates: local claims state for instant UI feedback
  const [optimisticClaims, setOptimisticClaims] = useState<Map<string, number>>(new Map());
  const pendingClaimsRef = useRef<Set<string>>(new Set());
  const hasAutoJoined = useRef(false);

  // Flatten claims from shares + merge with optimistic updates
  const allClaims: Claim[] = useMemo(() => {
    const serverClaims = bill?.shares.flatMap(share => 
      share.claims.map(claim => ({
        shareId: share.id,
        itemId: claim.itemId,
        portion: claim.portion,
      }))
    ) || [];
    
    // Apply optimistic updates on top of server state
    const claimsMap = new Map<string, Claim>();
    serverClaims.forEach(claim => {
      claimsMap.set(`${claim.shareId}-${claim.itemId}`, claim);
    });
    
    // Apply optimistic changes
    optimisticClaims.forEach((portion, key) => {
      const [shareId, itemId] = key.split('-');
      if (portion === 0) {
        claimsMap.delete(key);
      } else {
        claimsMap.set(key, { shareId, itemId, portion });
      }
    });
    
    return Array.from(claimsMap.values());
  }, [bill?.shares, optimisticClaims]);

  // Find current user's share
  const currentUserShare = useMemo(() => {
    if (!session?.user?.id || !bill) return null;
    return bill.shares.find(s => s.userId === session.user.id);
  }, [session?.user?.id, bill]);

  const fetchBill = useCallback(async () => {
    try {
      const response = await fetch(`/api/bills/${billId}`);
      
      if (!response.ok) throw new Error('Failed to fetch bill');
      const data = await response.json();
      setBill(data);
      return data;
    } catch (error) {
      console.error('Error fetching bill:', error);
      toast.error('Failed to load bill');
      return null;
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

  // Auto-join for auth-required bills
  const autoJoin = useCallback(async (billData: Bill) => {
    if (!session?.user?.id || !session?.user?.name) return;
    if (!billData.requiresAuth) return;
    if (hasAutoJoined.current) return;
    
    // Check if user already has a share
    const existingShare = billData.shares.find(s => s.userId === session.user.id);
    if (existingShare) {
      setCurrentShareId(existingShare.id);
      return;
    }
    
    hasAutoJoined.current = true;
    
    try {
      const response = await fetch(`/api/bills/${billId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: session.user.name || session.user.email?.split('@')[0] || 'User' }),
      });
      
      if (response.ok) {
        const newShare = await response.json();
        await fetchBill();
        setCurrentShareId(newShare.id);
        toast.success('You have joined the bill!');
      }
    } catch (error) {
      console.error('Error auto-joining bill:', error);
    }
  }, [session?.user?.id, session?.user?.name, session?.user?.email, billId, fetchBill]);

  useEffect(() => {
    const loadData = async () => {
      // Wait for auth status to be determined
      if (authStatus === 'loading') return;
      
      setIsLoading(true);
      const billData = await fetchBill();
      
      if (billData) {
        await fetchSplits();
        
        // For auth-required bills, handle auto-join
        if (billData.requiresAuth) {
          if (!session?.user?.id) {
            // Redirect to sign in
            signIn(undefined, { callbackUrl: `/bill/${billId}` });
            return;
          }
          await autoJoin(billData);
        } else {
          // Legacy bill: show join dialog if no shares
          if (billData.shares.length === 0) {
            setShowJoinDialog(true);
          }
        }
      }
      
      setIsLoading(false);
    };
    loadData();
  }, [fetchBill, fetchSplits, authStatus, session?.user?.id, billId, autoJoin]);

  // Set current share when user share is found
  useEffect(() => {
    if (currentUserShare && !currentShareId) {
      setCurrentShareId(currentUserShare.id);
    }
  }, [currentUserShare, currentShareId]);

  const handleAddShare = async (name: string, amountPaid?: number) => {
    try {
      const response = await fetch(`/api/bills/${billId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, amountPaid }),
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
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove person');
      }
      
      if (currentShareId === shareId) {
        setCurrentShareId(null);
      }
      setShowRemoveConfirmDialog(null);
      await fetchBill();
      await fetchSplits();
      toast.success('Person removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove person');
    }
  };

  const handleUpdatePayment = async (shareId: string, amount: number) => {
    if (!bill) return;
    
    // Frontend validation: check if payment would exceed bill total
    const currentTotalPaid = bill.shares.reduce((sum, s) => {
      if (s.id === shareId) return sum; // Exclude current share's old payment
      return sum + (s.amountPaid || 0);
    }, 0);
    
    const newTotalPaid = currentTotalPaid + amount;
    if (newTotalPaid > bill.total) {
      toast.error(`Total payments ($${newTotalPaid.toFixed(2)}) would exceed bill total ($${bill.total.toFixed(2)})`);
      return;
    }
    
    try {
      const response = await fetch(`/api/bills/${billId}/shares`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, amountPaid: amount }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update payment');
      }
      
      await fetchBill();
      await fetchSplits();
      setShowPaymentDialog(false);
      setPaymentAmount('');
      toast.success('Payment updated!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update payment');
    }
  };

  // Debounced server sync for splits recalculation
  const debouncedFetchSplits = useDebounce(fetchSplits, 300);

  const handleClaimChange = async (shareId: string, itemId: string, portion: number) => {
    const key = `${shareId}-${itemId}`;
    
    // Skip if already processing this exact claim
    if (pendingClaimsRef.current.has(key)) {
      return;
    }
    
    // Optimistic update: immediately update local state
    setOptimisticClaims(prev => {
      const next = new Map(prev);
      next.set(key, portion);
      return next;
    });
    
    // Mark as pending
    pendingClaimsRef.current.add(key);
    
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
      
      // Fetch updated data FIRST, then clear optimistic update
      await fetchBill();
      
      // Clear optimistic update AFTER server state is loaded
      setOptimisticClaims(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      
      debouncedFetchSplits();
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticClaims(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      toast.error('Failed to update selection');
    } finally {
      pendingClaimsRef.current.delete(key);
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

  const handleUnlockBill = async () => {
    try {
      await fetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: false }),
      });
      await fetchBill();
      toast.success('Bill unlocked! Selections can now be changed.');
    } catch (error) {
      toast.error('Failed to unlock bill');
    }
  };

  const [isCategorizing, setIsCategorizing] = useState(false);
  
  const handleCategorizeItems = async () => {
    if (!bill) return;
    
    // Check if there are items without categories
    const uncategorizedItems = bill.items.filter(item => !item.category);
    if (uncategorizedItems.length === 0) {
      toast.info('All items already have categories');
      return;
    }
    
    setIsCategorizing(true);
    try {
      // Get existing items and trigger re-categorization by sending them without categoryId
      const itemsToUpdate = bill.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        // Only preserve categoryId if item already has a category
        categoryId: item.category?.id || null,
      }));
      
      // For uncategorized items, explicitly set categoryId to null to trigger auto-categorization
      const itemsForPatch = itemsToUpdate.map(item => ({
        ...item,
        categoryId: item.categoryId || undefined, // undefined will trigger auto-categorization
      }));
      
      const response = await fetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsForPatch }),
      });
      
      if (response.ok) {
        await fetchBill();
        toast.success(`Categorized ${uncategorizedItems.length} items!`);
      } else {
        throw new Error('Failed to categorize');
      }
    } catch (error) {
      toast.error('Failed to categorize items');
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) {
      toast.error('Please enter an item name');
      return;
    }
    
    const price = parseFloat(newItemPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid price (0 or more)');
      return;
    }
    
    try {
      // Get current items and add the new one
      const updatedItems = [
        ...(bill?.items || []).map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        { name: newItemName.trim(), price, quantity: 1 }
      ];
      
      await fetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedItems }),
      });
      
      await fetchBill();
      await fetchSplits();
      setShowAddItemDialog(false);
      setNewItemName('');
      setNewItemPrice('');
      toast.success('Item added!');
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!bill) return;
    
    try {
      // Filter out the item to remove
      const updatedItems = bill.items
        .filter(item => item.id !== itemId)
        .map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        }));
      
      const response = await fetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedItems }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove item');
      }
      
      await fetchBill();
      await fetchSplits();
      toast.success('Item removed!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove item');
    }
  };

  const copyShareLink = async () => {
    const url = window.location.href;
    
    try {
      // Try using the modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
        return;
      }
    } catch (error) {
      console.warn('Clipboard API failed, trying fallback:', error);
    }
    
    // Fallback for older browsers or when clipboard API fails
    try {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        toast.success('Link copied to clipboard!');
      } else {
        toast.error('Failed to copy link. Please copy the URL manually.');
      }
    } catch (error) {
      console.error('Fallback copy failed:', error);
      toast.error('Failed to copy link. Please copy the URL manually.');
    }
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  // Loading state
  if (isLoading || authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading bill...</p>
        </div>
      </div>
    );
  }

  // Bill not found
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

  // Calculate total payments
  const totalPaid = bill.shares.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
  const remainingToPay = bill.total - totalPaid;

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
            {/* Only show lock/unlock for creator (auth bills) or anyone (legacy bills) */}
            {(!bill.requiresAuth || bill.isCreator) && (
              !bill.locked ? (
                <Button variant="outline" size="sm" onClick={handleLockBill} className="border-zinc-700">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Lock Bill
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleUnlockBill} className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  Unlock Bill
                </Button>
              )
            )}
            <UserMenu />
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
            {bill.isCreator && (
              <Badge variant="outline" className="border-emerald-500 text-emerald-400">
                Creator
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

        {/* Payment Summary for auth-required bills */}
        {bill.requiresAuth && (
          <Card className="p-4 mb-6 bg-zinc-900/50 border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Payment Status</h3>
              {currentUserShare && !bill.locked && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPaymentAmount(currentUserShare.amountPaid?.toString() || '');
                    setShowPaymentDialog(true);
                  }}
                  className="border-zinc-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {currentUserShare.amountPaid > 0 ? 'Edit Payment' : 'Record Payment'}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalPaid)}</p>
                <p className="text-xs text-zinc-500">Total Paid</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(bill.total)}</p>
                <p className="text-xs text-zinc-500">Bill Total</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${remainingToPay > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatCurrency(remainingToPay)}
                </p>
                <p className="text-xs text-zinc-500">Remaining</p>
              </div>
            </div>
            {bill.shares.some(s => s.amountPaid > 0) && (
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <p className="text-sm text-zinc-400 mb-2">Contributions:</p>
                <div className="flex flex-wrap gap-2">
                  {bill.shares.filter(s => s.amountPaid > 0).map(share => (
                    <Badge key={share.id} variant="outline" className="border-zinc-700">
                      {share.name}: {formatCurrency(share.amountPaid)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Sticky Selected User Total - Shows when a user is selected */}
        {currentShareId && splits?.splits && (() => {
          const selectedSplit = splits.splits.find(s => s.shareId === currentShareId);
          if (!selectedSplit) return null;
          return (
            <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <Card className="p-4 border-emerald-600 bg-gradient-to-r from-emerald-600/10 to-teal-600/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl font-bold">
                      {selectedSplit.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">Your Total</p>
                      <p className="font-semibold text-lg">{selectedSplit.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-emerald-400">
                      {formatCurrency(selectedSplit.grandTotal)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {selectedSplit.itemBreakdown.length} item{selectedSplit.itemBreakdown.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          );
        })()}

        {/* Main Content */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: Item Selection */}
          <div className="lg:col-span-3 space-y-6">
            {/* Participants */}
            {bill.shares.length > 0 && !bill.locked && (
              <Card className="p-4 bg-zinc-900/50 border-zinc-800">
                <label className="block text-sm text-zinc-400 mb-3">
                  {bill.requiresAuth ? 'Participants:' : 'I am:'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {bill.shares.map((share) => {
                    // For auth-required bills, users can only select their own share
                    const isOwnShare = share.userId === session?.user?.id;
                    const canSelect = !bill.requiresAuth || isOwnShare;
                    
                    return (
                      <Button
                        key={share.id}
                        variant={currentShareId === share.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => canSelect && setCurrentShareId(share.id)}
                        disabled={!canSelect}
                        className={`
                          ${currentShareId === share.id 
                            ? 'bg-emerald-600 hover:bg-emerald-700' 
                            : 'border-zinc-700'
                          }
                          ${!canSelect ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        title={!canSelect ? 'You can only select your own account' : undefined}
                      >
                        {share.name}
                        {bill.requiresAuth && isOwnShare && (
                          <span className="ml-1 text-xs">(you)</span>
                        )}
                      </Button>
                    );
                  })}
                  {/* Only show Join button for legacy bills */}
                  {!bill.requiresAuth && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowJoinDialog(true)}
                      className="border-dashed border-zinc-700"
                    >
                      + Join
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {/* Items */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Items</h2>
              <div className="flex items-center gap-2">
                {/* Categorize button - show if there are uncategorized items */}
                {!bill.locked && (!bill.requiresAuth || bill.isCreator) && 
                  bill.items.some(item => !item.category) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCategorizeItems}
                    disabled={isCategorizing}
                    className="border-zinc-700 text-zinc-400"
                  >
                    {isCategorizing ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-zinc-500 border-t-emerald-500 rounded-full animate-spin" />
                        Categorizing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Categorize
                      </>
                    )}
                  </Button>
                )}
                {/* Only creator can add items (for auth-required bills) or anyone (for legacy bills) */}
                {!bill.locked && (!bill.requiresAuth || bill.isCreator) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddItemDialog(true)}
                    className="border-zinc-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Item
                  </Button>
                )}
              </div>
            </div>
            <SelectionGrid
              items={bill.items}
              shares={bill.shares}
              claims={allClaims}
              currentShareId={currentShareId}
              onClaimChange={handleClaimChange}
              onAddShare={handleAddShare}
              onRemoveShare={(shareId) => {
                const share = bill.shares.find(s => s.id === shareId);
                if (share) {
                  if (bill.requiresAuth) {
                    // Show confirmation dialog for auth bills
                    setShowRemoveConfirmDialog({ id: shareId, name: share.name });
                  } else {
                    // Direct remove for legacy bills
                    handleRemoveShare(shareId);
                  }
                }
              }}
              onRemoveItem={handleRemoveItem}
              isLocked={bill.locked}
              requiresAuth={bill.requiresAuth}
              isCreator={bill.isCreator || false}
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
                settlements={splits?.settlements}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Join Dialog - Only for legacy bills */}
      {!bill.requiresAuth && (
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
      )}

      {/* Remove Confirmation Dialog - For auth-required bills */}
      <Dialog open={!!showRemoveConfirmDialog} onOpenChange={() => setShowRemoveConfirmDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Remove {showRemoveConfirmDialog?.name}?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to remove {showRemoveConfirmDialog?.name} from this bill? 
              This will delete all their item selections and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRemoveConfirmDialog(null)}
              className="border-zinc-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showRemoveConfirmDialog && handleRemoveShare(showRemoveConfirmDialog.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>{currentUserShare?.amountPaid ? 'Edit Your Payment' : 'Record Your Payment'}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Enter the amount you contributed to paying this bill.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Show max available to pay */}
            {(() => {
              const othersPayments = bill.shares.reduce((sum, s) => {
                if (s.id === currentUserShare?.id) return sum;
                return sum + (s.amountPaid || 0);
              }, 0);
              const maxCanPay = bill.total - othersPayments;
              return (
                <div className="text-sm text-zinc-400 p-2 bg-zinc-800/50 rounded">
                  Maximum you can record: <span className="text-emerald-400 font-medium">{formatCurrency(maxCanPay)}</span>
                  <span className="text-xs block text-zinc-500 mt-1">
                    (Bill total: {formatCurrency(bill.total)}, Others paid: {formatCurrency(othersPayments)})
                  </span>
                </div>
              );
            })()}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Amount paid</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
                autoFocus
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const othersPayments = bill.shares.reduce((sum, s) => {
                    if (s.id === currentUserShare?.id) return sum;
                    return sum + (s.amountPaid || 0);
                  }, 0);
                  const maxCanPay = bill.total - othersPayments;
                  setPaymentAmount(maxCanPay.toString());
                }}
                className="border-zinc-700"
              >
                Remaining ({formatCurrency(bill.total - bill.shares.reduce((sum, s) => s.id === currentUserShare?.id ? sum : sum + (s.amountPaid || 0), 0))})
              </Button>
              {currentUserShare && splits?.splits && (() => {
                const mySplit = splits.splits.find(s => s.shareId === currentUserShare.id);
                if (mySplit) {
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentAmount(mySplit.grandTotal.toString())}
                      className="border-zinc-700"
                    >
                      My Share ({formatCurrency(mySplit.grandTotal)})
                    </Button>
                  );
                }
                return null;
              })()}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
              className="border-zinc-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const amount = parseFloat(paymentAmount);
                if (!isNaN(amount) && amount >= 0 && currentUserShare) {
                  handleUpdatePayment(currentUserShare.id, amount);
                }
              }}
              disabled={!paymentAmount || isNaN(parseFloat(paymentAmount))}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Add a new item to the bill
            </p>
            <Input
              placeholder="Item name..."
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="bg-zinc-800 border-zinc-700"
              autoFocus
            />
            <Input
              placeholder="Price (e.g., 9.99)"
              type="number"
              step="0.01"
              min="0"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newItemName.trim() && newItemPrice) {
                  handleAddItem();
                }
              }}
              className="bg-zinc-800 border-zinc-700"
            />
            <Button
              onClick={handleAddItem}
              disabled={!newItemName.trim() || !newItemPrice}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
