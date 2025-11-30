'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { calculateBalances, suggestSettlements, formatCurrency } from '@/lib/calculations';

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
  total: number;
}

export default function DashboardPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  // Calculate overall balances across all bills
  const allPersonNames = [...new Set(bills.flatMap(b => b.shares.map(s => s.name)))];
  
  // For now, assume the first person on each bill is the payer
  // In a real app, you'd track this explicitly
  const billsWithTotals = bills.map(bill => {
    const personTotals = bill.shares.map(share => {
      const itemsTotal = share.claims.reduce((sum, claim) => {
        const item = bill.items.find(i => i.id === claim.itemId);
        if (!item) return sum;
        const itemClaims = bill.shares.flatMap(s => s.claims.filter(c => c.itemId === item.id));
        const totalPortions = itemClaims.reduce((p, c) => p + c.portion, 0);
        return sum + (item.price * item.quantity * claim.portion) / (totalPortions || 1);
      }, 0);
      
      const billSubtotal = bill.items.reduce((s, i) => s + i.price * i.quantity, 0);
      const proportion = billSubtotal > 0 ? itemsTotal / billSubtotal : 0;
      
      return {
        shareId: share.id,
        name: share.name,
        itemsTotal: Math.round(itemsTotal * 100) / 100,
        taxShare: Math.round(bill.taxAmount * proportion * 100) / 100,
        tipShare: Math.round(bill.tipAmount * proportion * 100) / 100,
        grandTotal: Math.round((itemsTotal + bill.taxAmount * proportion + bill.tipAmount * proportion) * 100) / 100,
        itemBreakdown: [],
      };
    });
    
    return {
      bill,
      personTotals,
      paidBy: bill.shares[0]?.name || 'Unknown',
    };
  });

  const balances = calculateBalances(billsWithTotals.filter(b => b.personTotals.length > 0));
  const settlements = suggestSettlements(balances);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading dashboard...</p>
        </div>
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
          <Link href="/">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Bill
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <p className="text-sm text-zinc-500 mb-1">Total Bills</p>
            <p className="text-3xl font-bold">{bills.length}</p>
          </Card>
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <p className="text-sm text-zinc-500 mb-1">People Tracked</p>
            <p className="text-3xl font-bold">{allPersonNames.length}</p>
          </Card>
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <p className="text-sm text-zinc-500 mb-1">Total Spent</p>
            <p className="text-3xl font-bold text-emerald-400">
              {formatCurrency(bills.reduce((sum, b) => sum + b.total, 0))}
            </p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Bills List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold">Recent Bills</h2>
            
            {bills.length === 0 ? (
              <Card className="p-8 bg-zinc-900/50 border-zinc-800 text-center">
                <svg className="w-12 h-12 text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="font-semibold mb-2">No bills yet</h3>
                <p className="text-zinc-500 mb-4">Create your first bill to start tracking expenses</p>
                <Link href="/">
                  <Button className="bg-emerald-600 hover:bg-emerald-700">Create Bill</Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-3">
                {bills.map((bill) => (
                  <Card
                    key={bill.id}
                    className="p-4 bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/bill/${bill.id}`} className="font-semibold hover:text-emerald-400 transition-colors">
                            {bill.name}
                          </Link>
                          {bill.locked && (
                            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400">
                              Locked
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-zinc-500">
                          <span>
                            {new Date(bill.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span>{bill.items.length} items</span>
                          <span>{bill.shares.length} people</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold text-emerald-400">
                          {formatCurrency(bill.total)}
                        </span>
                        
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
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Settlements */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Settlements</h2>
            
            {settlements.length === 0 ? (
              <Card className="p-6 bg-zinc-900/50 border-zinc-800 text-center">
                <svg className="w-10 h-10 text-emerald-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-zinc-400">All settled up!</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {settlements.map((settlement, i) => (
                  <Card
                    key={i}
                    className="p-4 bg-zinc-900/50 border-zinc-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-sm font-medium text-red-400">
                          {settlement.from.charAt(0)}
                        </div>
                        <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm font-medium text-emerald-400">
                          {settlement.to.charAt(0)}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-400">
                          {formatCurrency(settlement.amount)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {settlement.from} → {settlement.to}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Balances */}
            {balances.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-6">Balances</h3>
                <div className="space-y-2">
                  {balances.map((balance, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/30"
                    >
                      <span className="text-zinc-400">{balance.personName}</span>
                      <span
                        className={`font-medium ${
                          balance.amount > 0
                            ? 'text-emerald-400'
                            : balance.amount < 0
                            ? 'text-red-400'
                            : 'text-zinc-500'
                        }`}
                      >
                        {balance.amount > 0 ? '+' : ''}
                        {formatCurrency(balance.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

