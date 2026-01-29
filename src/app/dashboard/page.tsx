'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export default function DashboardPage() {
  const { data: session } = useSession();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBills();
  }, []);

  // Check if user is the creator of a bill
  const isCreator = (bill: Bill) => bill.userId === session?.user?.id;
  
  // Check if user is a participant in a bill
  const isParticipant = (bill: Bill) => bill.shares.some(s => s.userId === session?.user?.id);

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

  // Calculate overall balances across all bills
  const allPersonNames = [...new Set(bills.flatMap(b => b.shares.map(s => s.name)))];
  
  // Calculate totals per person per bill, using payments array
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
    
    // Get payments from shares (new format)
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

  // Calculate stats
  const totalSpent = bills.reduce((sum, b) => sum + b.total, 0);
  
  // This month's spending
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthBills = bills.filter(b => new Date(b.createdAt) >= startOfMonth);
  const thisMonthSpent = thisMonthBills.reduce((sum, b) => sum + b.total, 0);
  
  // Calculate what user owes vs what's owed to user
  const userBalance = balances.find(b => b.personName === session?.user?.name);
  const youOwe = settlements
    .filter(s => s.from === session?.user?.name)
    .reduce((sum, s) => sum + s.amount, 0);
  const owedToYou = settlements
    .filter(s => s.to === session?.user?.name)
    .reduce((sum, s) => sum + s.amount, 0);

  // Recent bills (last 5)
  const recentBills = [...bills]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-zinc-400">Here&apos;s your expense overview</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Spent"
          value={formatCurrency(totalSpent)}
          subtitle="All time"
          variant="success"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="This Month"
          value={formatCurrency(thisMonthSpent)}
          subtitle={`${thisMonthBills.length} bills`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatsCard
          title="You Owe"
          value={formatCurrency(youOwe)}
          subtitle={youOwe > 0 ? 'Pending settlements' : 'All clear!'}
          variant={youOwe > 0 ? 'danger' : 'default'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          }
        />
        <StatsCard
          title="Owed to You"
          value={formatCurrency(owedToYou)}
          subtitle={owedToYou > 0 ? 'Pending settlements' : 'All clear!'}
          variant={owedToYou > 0 ? 'success' : 'default'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h14m-6 4v1a3 3 0 003 3h4a3 3 0 003-3V7a3 3 0 00-3-3h-4a3 3 0 00-3 3v1" />
            </svg>
          }
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recent Bills */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Bills</h2>
            <Link href="/dashboard/bills" className="text-sm text-emerald-400 hover:text-emerald-300">
              View all
            </Link>
          </div>
          
          {recentBills.length === 0 ? (
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
              {recentBills.map((bill) => {
                const userIsCreator = isCreator(bill);
                const userIsParticipant = isParticipant(bill);
                const totalBillPaid = bill.shares.reduce((s, share) => s + (share.amountPaid || 0), 0);
                
                return (
                  <Link key={bill.id} href={`/bill/${bill.id}`}>
                    <Card className="p-4 bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold hover:text-emerald-400 transition-colors">
                              {bill.name}
                            </span>
                            {bill.locked && (
                              <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400">
                                Locked
                              </Badge>
                            )}
                            {bill.requiresAuth && userIsCreator && (
                              <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                                Creator
                              </Badge>
                            )}
                            {bill.requiresAuth && !userIsCreator && userIsParticipant && (
                              <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                                Participant
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
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Settlements Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pending Settlements</h2>
            <Link href="/dashboard/settlements" className="text-sm text-emerald-400 hover:text-emerald-300">
              View all
            </Link>
          </div>
          
          {settlements.length === 0 ? (
            <Card className="p-6 bg-zinc-900/50 border-zinc-800 text-center">
              <svg className="w-10 h-10 text-emerald-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium text-emerald-400">All settled up!</p>
              <p className="text-sm text-zinc-500 mt-1">No pending settlements</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {settlements.slice(0, 3).map((settlement, i) => (
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
              {settlements.length > 3 && (
                <Link href="/dashboard/settlements">
                  <Button variant="outline" className="w-full border-zinc-700">
                    View {settlements.length - 3} more
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Quick Stats */}
          <Card className="p-4 bg-zinc-900/50 border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Quick Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Total Bills</span>
                <span className="font-medium">{bills.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">People Tracked</span>
                <span className="font-medium">{allPersonNames.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Avg Bill Size</span>
                <span className="font-medium">
                  {bills.length > 0 ? formatCurrency(totalSpent / bills.length) : '$0.00'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
