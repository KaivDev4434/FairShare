'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/calculations';

interface Item {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Share {
  id: string;
  name: string;
  claims: { itemId: string; portion: number }[];
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
  total: number;
  userId?: string | null;
}

type FilterType = 'all' | 'created' | 'shared' | 'legacy';
type SortType = 'recent' | 'oldest' | 'highest' | 'lowest';

export default function BillsPage() {
  const { data: session } = useSession();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('recent');

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      const response = await fetch('/api/bills');
      if (!response.ok) throw new Error('Failed to fetch bills');
      const data = await response.json();
      setBills(data);
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error('Failed to load bills');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBill = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete bill');
      setBills(bills.filter(b => b.id !== id));
      toast.success('Bill deleted');
    } catch (error) {
      toast.error('Failed to delete bill');
    } finally {
      setDeletingId(null);
    }
  };

  const isCreator = (bill: Bill) => bill.userId === session?.user?.id;
  const isParticipant = (bill: Bill) => bill.shares.some(s => s.userId === session?.user?.id);

  // Filter and sort bills
  const filteredBills = useMemo(() => {
    let result = [...bills];

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(b => 
        b.name.toLowerCase().includes(searchLower) ||
        b.shares.some(s => s.name.toLowerCase().includes(searchLower))
      );
    }

    // Apply filter
    switch (filter) {
      case 'created':
        result = result.filter(b => isCreator(b));
        break;
      case 'shared':
        result = result.filter(b => !isCreator(b) && isParticipant(b));
        break;
      case 'legacy':
        result = result.filter(b => !b.requiresAuth);
        break;
    }

    // Apply sort
    switch (sort) {
      case 'recent':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'highest':
        result.sort((a, b) => b.total - a.total);
        break;
      case 'lowest':
        result.sort((a, b) => a.total - b.total);
        break;
    }

    return result;
  }, [bills, search, filter, sort, session?.user?.id]);

  // Count for filter badges
  const createdCount = bills.filter(b => isCreator(b)).length;
  const sharedCount = bills.filter(b => !isCreator(b) && isParticipant(b)).length;
  const legacyCount = bills.filter(b => !b.requiresAuth).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading bills...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bills</h1>
          <p className="text-zinc-400">Manage all your bills and expenses</p>
        </div>
        <Link href="/">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Bill
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <svg 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder="Search bills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800"
          />
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortType)}
          className="px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-sm"
        >
          <option value="recent">Most Recent</option>
          <option value="oldest">Oldest First</option>
          <option value="highest">Highest Amount</option>
          <option value="lowest">Lowest Amount</option>
        </select>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'bg-emerald-600' : 'border-zinc-700'}
        >
          All ({bills.length})
        </Button>
        <Button
          variant={filter === 'created' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('created')}
          className={filter === 'created' ? 'bg-emerald-600' : 'border-zinc-700'}
        >
          Created by me ({createdCount})
        </Button>
        <Button
          variant={filter === 'shared' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('shared')}
          className={filter === 'shared' ? 'bg-emerald-600' : 'border-zinc-700'}
        >
          Shared with me ({sharedCount})
        </Button>
        <Button
          variant={filter === 'legacy' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('legacy')}
          className={filter === 'legacy' ? 'bg-emerald-600' : 'border-zinc-700'}
        >
          Legacy ({legacyCount})
        </Button>
      </div>

      {/* Bills List */}
      {filteredBills.length === 0 ? (
        <Card className="p-8 bg-zinc-900/50 border-zinc-800 text-center">
          <svg className="w-12 h-12 text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {search || filter !== 'all' ? (
            <>
              <h3 className="font-semibold mb-2">No bills found</h3>
              <p className="text-zinc-500 mb-4">Try adjusting your search or filters</p>
              <Button 
                variant="outline" 
                className="border-zinc-700"
                onClick={() => { setSearch(''); setFilter('all'); }}
              >
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <h3 className="font-semibold mb-2">No bills yet</h3>
              <p className="text-zinc-500 mb-4">Create your first bill to start tracking expenses</p>
              <Link href="/">
                <Button className="bg-emerald-600 hover:bg-emerald-700">Create Bill</Button>
              </Link>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBills.map((bill) => {
            const userIsCreator = isCreator(bill);
            const userIsParticipant = isParticipant(bill);
            const totalBillPaid = bill.shares.reduce((s, share) => s + (share.amountPaid || 0), 0);
            const userShare = bill.shares.find(s => s.userId === session?.user?.id);
            
            // Calculate user's share amount
            let userShareAmount = 0;
            if (userShare) {
              const itemsTotal = userShare.claims.reduce((sum, claim) => {
                const item = bill.items.find(i => i.id === claim.itemId);
                if (!item) return sum;
                const itemClaims = bill.shares.flatMap(s => s.claims.filter(c => c.itemId === item.id));
                const totalPortions = itemClaims.reduce((p, c) => p + c.portion, 0);
                return sum + (item.price * item.quantity * claim.portion) / (totalPortions || 1);
              }, 0);
              
              const billSubtotal = bill.items.reduce((s, i) => s + i.price * i.quantity, 0);
              const proportion = billSubtotal > 0 ? itemsTotal / billSubtotal : 0;
              userShareAmount = itemsTotal + bill.taxAmount * proportion + bill.tipAmount * proportion;
            }
            
            return (
              <Card
                key={bill.id}
                className="p-4 bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link href={`/bill/${bill.id}`} className="font-semibold hover:text-emerald-400 transition-colors truncate">
                        {bill.name}
                      </Link>
                      {bill.locked && (
                        <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400 shrink-0">
                          Locked
                        </Badge>
                      )}
                      {bill.requiresAuth && userIsCreator && (
                        <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400 shrink-0">
                          Creator
                        </Badge>
                      )}
                      {bill.requiresAuth && !userIsCreator && userIsParticipant && (
                        <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400 shrink-0">
                          Participant
                        </Badge>
                      )}
                      {!bill.requiresAuth && (
                        <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400 shrink-0">
                          Legacy
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-500 flex-wrap">
                      <span>
                        {new Date(bill.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span>{bill.items.length} items</span>
                      <span>{bill.shares.length} people</span>
                      {userShareAmount > 0 && (
                        <span className="text-amber-400">
                          Your share: {formatCurrency(userShareAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Participant avatars */}
                  <div className="hidden sm:flex -space-x-2">
                    {bill.shares.slice(0, 4).map((share, i) => (
                      <div
                        key={share.id}
                        className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium border-2 border-zinc-900"
                        title={share.name}
                      >
                        {share.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {bill.shares.length > 4 && (
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium border-2 border-zinc-900">
                        +{bill.shares.length - 4}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-lg font-semibold text-emerald-400">
                        {formatCurrency(bill.total)}
                      </span>
                      {bill.requiresAuth && totalBillPaid > 0 && (
                        <p className="text-xs text-zinc-500">
                          {formatCurrency(totalBillPaid)} paid
                        </p>
                      )}
                    </div>
                    
                    {userIsCreator && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-red-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-900 border-zinc-800">
                          <DialogHeader>
                            <DialogTitle>Delete Bill</DialogTitle>
                          </DialogHeader>
                          <p className="text-zinc-400">
                            Are you sure you want to delete &quot;{bill.name}&quot;? This action cannot be undone.
                          </p>
                          <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" className="border-zinc-700">
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleDeleteBill(bill.id)}
                              disabled={deletingId === bill.id}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {deletingId === bill.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
