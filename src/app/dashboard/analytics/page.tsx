'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SpendingPieChart, SpendingLineChart, SpendingBarChart } from '@/components/dashboard/SpendingChart';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/calculations';

interface Item {
  id: string;
  name: string;
  price: number;
  quantity: number;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
    color?: string | null;
    parent?: {
      name: string;
      slug: string;
      color?: string | null;
    } | null;
  } | null;
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

type TimePeriod = 'month' | '3months' | '6months' | 'year' | 'all';

const CATEGORY_COLORS: Record<string, string> = {
  'food': '#f97316', // orange
  'transportation': '#3b82f6', // blue
  'entertainment': '#a855f7', // purple
  'shopping': '#ec4899', // pink
  'utilities': '#eab308', // yellow
  'healthcare': '#ef4444', // red
  'travel': '#06b6d4', // cyan
  'education': '#6366f1', // indigo
  'other': '#71717a', // gray
};

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('3months');

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
      toast.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter bills by time period
  const filteredBills = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timePeriod) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
      default:
        return bills;
    }

    return bills.filter(b => new Date(b.createdAt) >= startDate);
  }, [bills, timePeriod]);

  // Calculate user's share of spending (what they actually owe)
  const calculateUserShare = (bill: Bill) => {
    const userShare = bill.shares.find(s => s.userId === session?.user?.id);
    if (!userShare) return 0;

    const itemsTotal = userShare.claims.reduce((sum, claim) => {
      const item = bill.items.find(i => i.id === claim.itemId);
      if (!item) return sum;
      const itemClaims = bill.shares.flatMap(s => s.claims.filter(c => c.itemId === item.id));
      const totalPortions = itemClaims.reduce((p, c) => p + c.portion, 0);
      return sum + (item.price * item.quantity * claim.portion) / (totalPortions || 1);
    }, 0);

    const billSubtotal = bill.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const proportion = billSubtotal > 0 ? itemsTotal / billSubtotal : 0;

    return itemsTotal + bill.taxAmount * proportion + bill.tipAmount * proportion;
  };

  // Stats
  const totalSpending = filteredBills.reduce((sum, b) => sum + calculateUserShare(b), 0);
  const avgBillSize = filteredBills.length > 0 ? totalSpending / filteredBills.length : 0;

  // Category breakdown (based on items in user's claims)
  const categoryData = useMemo(() => {
    const categoryTotals: Record<string, { name: string; value: number; color: string }> = {};

    filteredBills.forEach(bill => {
      const userShare = bill.shares.find(s => s.userId === session?.user?.id);
      if (!userShare) return;

      userShare.claims.forEach(claim => {
        const item = bill.items.find(i => i.id === claim.itemId);
        if (!item) return;

        const itemClaims = bill.shares.flatMap(s => s.claims.filter(c => c.itemId === item.id));
        const totalPortions = itemClaims.reduce((p, c) => p + c.portion, 0);
        const amount = (item.price * item.quantity * claim.portion) / (totalPortions || 1);

        // Get category info
        const categorySlug = item.category?.parent?.slug || item.category?.slug || 'other';
        const categoryName = item.category?.parent?.name || item.category?.name || 'Uncategorized';
        const color = CATEGORY_COLORS[categorySlug] || CATEGORY_COLORS['other'];

        if (!categoryTotals[categorySlug]) {
          categoryTotals[categorySlug] = { name: categoryName, value: 0, color };
        }
        categoryTotals[categorySlug].value += amount;
      });
    });

    return Object.values(categoryTotals).sort((a, b) => b.value - a.value);
  }, [filteredBills, session?.user?.id]);

  // Monthly spending over time
  const monthlyData = useMemo(() => {
    const monthlyTotals: Record<string, { amount: number; date: Date }> = {};

    filteredBills.forEach(bill => {
      const date = new Date(bill.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = calculateUserShare(bill);

      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = { amount: 0, date: new Date(date.getFullYear(), date.getMonth(), 1) };
      }
      monthlyTotals[monthKey].amount += amount;
    });

    return Object.entries(monthlyTotals)
      .map(([key, data]) => ({
        date: key,
        amount: Math.round(data.amount * 100) / 100,
        label: data.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredBills]);

  // Top category
  const topCategory = categoryData[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Spending Analytics</h1>
          <p className="text-zinc-400">Track your spending patterns and habits</p>
        </div>

        {/* Time Period Selector */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'month', label: 'This Month' },
            { value: '3months', label: '3 Months' },
            { value: '6months', label: '6 Months' },
            { value: 'year', label: 'This Year' },
            { value: 'all', label: 'All Time' },
          ].map(({ value, label }) => (
            <Button
              key={value}
              variant={timePeriod === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimePeriod(value as TimePeriod)}
              className={timePeriod === value ? 'bg-emerald-600' : 'border-zinc-700'}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Spending"
          value={formatCurrency(totalSpending)}
          subtitle={`${filteredBills.length} bills`}
          variant="success"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Average Bill"
          value={formatCurrency(avgBillSize)}
          subtitle="Your share"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatsCard
          title="Bills Count"
          value={filteredBills.length.toString()}
          subtitle="In selected period"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Top Category"
          value={topCategory?.name || 'N/A'}
          subtitle={topCategory ? formatCurrency(topCategory.value) : 'No data'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          }
        />
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Spending Over Time */}
        <Card className="p-6 bg-zinc-900/50 border-zinc-800">
          <h3 className="text-lg font-semibold mb-4">Spending Over Time</h3>
          <SpendingLineChart data={monthlyData} height={280} />
        </Card>

        {/* Category Breakdown */}
        <Card className="p-6 bg-zinc-900/50 border-zinc-800">
          <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
          <SpendingPieChart data={categoryData} height={280} />
        </Card>
      </div>

      {/* Top Categories Bar Chart */}
      <Card className="p-6 bg-zinc-900/50 border-zinc-800">
        <h3 className="text-lg font-semibold mb-4">Top Spending Categories</h3>
        <SpendingBarChart data={categoryData.slice(0, 8)} height={300} horizontal />
      </Card>

      {/* Spending Table */}
      {categoryData.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-lg font-semibold">Category Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left p-4 text-sm font-medium text-zinc-400">Category</th>
                  <th className="text-right p-4 text-sm font-medium text-zinc-400">Amount</th>
                  <th className="text-right p-4 text-sm font-medium text-zinc-400">% of Total</th>
                  <th className="text-right p-4 text-sm font-medium text-zinc-400 hidden sm:table-cell">Visualization</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map((category, i) => {
                  const percentage = totalSpending > 0 ? (category.value / totalSpending) * 100 : 0;
                  return (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="font-medium">{category.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-medium text-emerald-400">
                        {formatCurrency(category.value)}
                      </td>
                      <td className="p-4 text-right text-zinc-400">
                        {percentage.toFixed(1)}%
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <div className="w-full bg-zinc-800 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: category.color,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {filteredBills.length === 0 && (
        <Card className="p-8 bg-zinc-900/50 border-zinc-800 text-center">
          <svg className="w-12 h-12 text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="font-semibold mb-2">No data for this period</h3>
          <p className="text-zinc-500">Try selecting a different time period or create some bills first.</p>
        </Card>
      )}
    </div>
  );
}
