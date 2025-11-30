'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

interface TotalsSummaryProps {
  splits: PersonTotal[];
  billTotal: number;
  highlightShareId?: string | null;
}

export function TotalsSummary({ splits, billTotal, highlightShareId }: TotalsSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalClaimed = splits.reduce((sum, p) => sum + p.grandTotal, 0);
  const unclaimed = billTotal - totalClaimed;

  if (splits.length === 0) {
    return (
      <Card className="p-6 bg-zinc-900/50 border-zinc-800">
        <p className="text-zinc-500 text-center">
          Add people and select items to see the split
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-zinc-900/50 border-zinc-800">
          <p className="text-sm text-zinc-500">Bill Total</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(billTotal)}</p>
        </Card>
        <Card className={`p-4 border-zinc-800 ${unclaimed > 0.01 ? 'bg-amber-500/10' : 'bg-zinc-900/50'}`}>
          <p className="text-sm text-zinc-500">Unclaimed</p>
          <p className={`text-2xl font-bold ${unclaimed > 0.01 ? 'text-amber-400' : 'text-zinc-500'}`}>
            {formatCurrency(unclaimed)}
          </p>
        </Card>
      </div>

      {/* Per-person breakdown */}
      <div className="space-y-3">
        {splits.map((person) => (
          <Card
            key={person.shareId}
            className={`
              p-4 border transition-all
              ${highlightShareId === person.shareId 
                ? 'border-emerald-600 bg-emerald-600/5' 
                : 'border-zinc-800 bg-zinc-900/50'
              }
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-lg font-bold">
                  {person.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{person.name}</p>
                  <p className="text-xs text-zinc-500">
                    {person.itemBreakdown.length} item{person.itemBreakdown.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-400">
                  {formatCurrency(person.grandTotal)}
                </p>
              </div>
            </div>

            {/* Item breakdown */}
            {person.itemBreakdown.length > 0 && (
              <div className="space-y-1 pt-3 border-t border-zinc-800">
                {person.itemBreakdown.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-zinc-400 flex items-center gap-2">
                      {item.itemName}
                      {item.sharedWith > 1 && (
                        <Badge variant="outline" className="text-xs border-zinc-700 px-1.5 py-0">
                          ÷{item.sharedWith}
                        </Badge>
                      )}
                      {item.portion !== 1 && (
                        <Badge variant="outline" className="text-xs border-zinc-700 px-1.5 py-0">
                          {item.portion}×
                        </Badge>
                      )}
                    </span>
                    <span className="text-zinc-300">{formatCurrency(item.amountOwed)}</span>
                  </div>
                ))}
                
                {/* Tax & Tip */}
                {(person.taxShare > 0 || person.tipShare > 0) && (
                  <>
                    <div className="border-t border-zinc-800 my-2" />
                    {person.taxShare > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Tax</span>
                        <span className="text-zinc-400">{formatCurrency(person.taxShare)}</span>
                      </div>
                    )}
                    {person.tipShare > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Tip</span>
                        <span className="text-zinc-400">{formatCurrency(person.tipShare)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Warning if not fully claimed */}
      {unclaimed > 0.01 && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              {formatCurrency(unclaimed)} worth of items haven&apos;t been claimed yet
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

