'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { toast } from 'sonner';
import { calculateBalances, suggestSettlements, formatCurrency, Payment } from '@/lib/calculations';

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

export default function SettlementsPage() {
  const { data: session } = useSession();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      toast.error('Failed to load settlements');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate balances and settlements
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
    
    const payments: Payment[] = bill.shares
      .filter(s => s.amountPaid > 0)
      .map(s => ({
        name: s.name,
        amount: s.amountPaid,
      }));
    
    const hasPayments = payments.length > 0;
    
    return {
      bill,
      personTotals,
      payments: hasPayments ? payments : undefined,
      paidBy: hasPayments ? undefined : bill.shares[0]?.name || 'Unknown',
    };
  });

  const balances = calculateBalances(billsWithTotals.filter(b => b.personTotals.length > 0));
  const settlements = suggestSettlements(balances);

  // Calculate stats for current user
  const youOwe = settlements
    .filter(s => s.from === session?.user?.name)
    .reduce((sum, s) => sum + s.amount, 0);
  const owedToYou = settlements
    .filter(s => s.to === session?.user?.name)
    .reduce((sum, s) => sum + s.amount, 0);
  const netBalance = owedToYou - youOwe;

  // Separate settlements by involvement
  const yourSettlements = settlements.filter(
    s => s.from === session?.user?.name || s.to === session?.user?.name
  );
  const otherSettlements = settlements.filter(
    s => s.from !== session?.user?.name && s.to !== session?.user?.name
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading settlements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settlements</h1>
        <p className="text-zinc-400">Track and manage who owes whom</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="You Owe"
          value={formatCurrency(youOwe)}
          variant="danger"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          }
        />
        <StatsCard
          title="Owed to You"
          value={formatCurrency(owedToYou)}
          variant="success"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h14m-6 4v1a3 3 0 003 3h4a3 3 0 003-3V7a3 3 0 00-3-3h-4a3 3 0 00-3 3v1" />
            </svg>
          }
        />
        <StatsCard
          title="Net Balance"
          value={formatCurrency(Math.abs(netBalance))}
          subtitle={netBalance >= 0 ? 'In your favor' : 'You owe overall'}
          variant={netBalance >= 0 ? 'success' : 'danger'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          }
        />
      </div>

      {/* Your Settlements */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Settlements</h2>
        
        {yourSettlements.length === 0 ? (
          <Card className="p-8 bg-zinc-900/50 border-zinc-800 text-center">
            <svg className="w-12 h-12 text-emerald-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-semibold text-emerald-400 mb-2">All settled up!</h3>
            <p className="text-zinc-500">You don&apos;t owe anyone and no one owes you.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {yourSettlements.map((settlement, i) => {
              const isYouOwe = settlement.from === session?.user?.name;
              
              return (
                <Card
                  key={i}
                  className={`p-4 border ${
                    isYouOwe 
                      ? 'bg-red-500/5 border-red-500/20' 
                      : 'bg-emerald-500/5 border-emerald-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                        isYouOwe ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {isYouOwe ? settlement.to.charAt(0) : settlement.from.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">
                          {isYouOwe 
                            ? `You owe ${settlement.to}`
                            : `${settlement.from} owes you`
                          }
                        </p>
                        <p className="text-sm text-zinc-500">
                          {isYouOwe ? 'Payment needed' : 'Payment expected'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${isYouOwe ? 'text-red-400' : 'text-emerald-400'}`}>
                        {formatCurrency(settlement.amount)}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Other Settlements */}
      {otherSettlements.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Other Settlements</h2>
          <p className="text-sm text-zinc-500">Settlements between other people in your bills</p>
          
          <div className="space-y-3">
            {otherSettlements.map((settlement, i) => (
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
                    <span className="text-sm text-zinc-400 ml-2">
                      {settlement.from} → {settlement.to}
                    </span>
                  </div>
                  <span className="font-semibold text-zinc-300">
                    {formatCurrency(settlement.amount)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Balances */}
      {balances.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">All Balances</h2>
          <p className="text-sm text-zinc-500">Net balance for each person across all bills</p>
          
          <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
            <div className="divide-y divide-zinc-800">
              {balances.map((balance, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      balance.amount > 0 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : balance.amount < 0 
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {balance.personName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium">{balance.personName}</span>
                      {balance.personName === session?.user?.name && (
                        <span className="ml-2 text-xs text-emerald-400">(You)</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-semibold ${
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
                    <p className="text-xs text-zinc-500">
                      {balance.amount > 0 
                        ? 'Is owed' 
                        : balance.amount < 0 
                        ? 'Owes' 
                        : 'Settled'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
