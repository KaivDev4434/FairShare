'use client';

import { useState, useCallback, memo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';

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

interface Share {
  id: string;
  name: string;
}

interface Claim {
  shareId: string;
  itemId: string;
  portion: number;
}

interface SelectionGridProps {
  items: Item[];
  shares: Share[];
  claims: Claim[];
  currentShareId: string | null;
  onClaimChange: (shareId: string, itemId: string, portion: number) => void;
  onAddShare: (name: string) => void;
  onRemoveShare: (shareId: string) => void;
  onRemoveItem?: (itemId: string) => void;  // Optional: for removing items
  isLocked?: boolean;
  requiresAuth?: boolean;  // Whether this is a new auth-required bill
  isCreator?: boolean;     // Whether current user is the bill creator
}

export const SelectionGrid = memo(function SelectionGrid({
  items,
  shares,
  claims,
  currentShareId,
  onClaimChange,
  onAddShare,
  onRemoveShare,
  onRemoveItem,
  isLocked = false,
  requiresAuth = false,
  isCreator = false,
}: SelectionGridProps) {
  const [showPortionDialog, setShowPortionDialog] = useState<{ itemId: string; shareId: string } | null>(null);
  const [showDeleteItemDialog, setShowDeleteItemDialog] = useState<{ id: string; name: string } | null>(null);

  const getClaim = useCallback((shareId: string, itemId: string): Claim | undefined => {
    return claims.find(c => c.shareId === shareId && c.itemId === itemId);
  }, [claims]);

  const getItemClaimants = useCallback((itemId: string): string[] => {
    return claims
      .filter(c => c.itemId === itemId && c.portion > 0)
      .map(c => shares.find(s => s.id === c.shareId)?.name || 'Unknown');
  }, [claims, shares]);
  
  // Check if creator can modify items (for auth bills only creator, for legacy anyone)
  const canModifyItems = !isLocked && (!requiresAuth || isCreator);

  const handleCheckboxChange = (shareId: string, itemId: string, checked: boolean) => {
    onClaimChange(shareId, itemId, checked ? 1 : 0);
  };

  const handlePortionChange = (shareId: string, itemId: string, portion: number) => {
    onClaimChange(shareId, itemId, portion);
    setShowPortionDialog(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Category color mapping
  const getCategoryColor = (color?: string | null) => {
    const colorMap: Record<string, string> = {
      orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      red: 'bg-red-500/20 text-red-400 border-red-500/30',
      cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      gray: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
    };
    return colorMap[color || 'gray'] || colorMap.gray;
  };

  // Check if current user has any claims for an item
  const isItemSelectedByCurrentUser = useCallback((itemId: string): boolean => {
    if (!currentShareId) return false;
    const claim = getClaim(currentShareId, itemId);
    return claim !== undefined && claim.portion > 0;
  }, [currentShareId, getClaim]);

  return (
    <div className="space-y-4">
      {/* Items Selection */}
      <div className="space-y-2">
        {items.map((item) => {
          const claimants = getItemClaimants(item.id);
          const currentClaim = currentShareId ? getClaim(currentShareId, item.id) : undefined;
          // Explicitly check if THIS user has selected this item (not other users)
          const isSelected = isItemSelectedByCurrentUser(item.id);

          return (
            <div
              key={item.id}
              className={`
                p-4 rounded-lg border transition-all
                ${isSelected 
                  ? 'border-emerald-600 bg-emerald-600/10' 
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {currentShareId && !isLocked && (
                    <Checkbox
                      checked={isSelected === true}
                      onCheckedChange={(checked) => 
                        handleCheckboxChange(currentShareId, item.id, checked === true)
                      }
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{item.name}</p>
                      {item.category && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs px-1.5 py-0 ${getCategoryColor(item.category.parent?.color || item.category.color)}`}
                        >
                          {item.category.name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500">
                      {item.quantity > 1 ? `${item.quantity} × ` : ''}
                      {formatCurrency(item.price)}
                      {item.quantity > 1 && ` = ${formatCurrency(item.price * item.quantity)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Show who's sharing this item */}
                  {claimants.length > 0 && (
                    <div className="flex -space-x-2">
                      {claimants.slice(0, 4).map((name, i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium border-2 border-zinc-900"
                          title={name}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {claimants.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium border-2 border-zinc-900">
                          +{claimants.length - 4}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Portion selector for current user */}
                  {isSelected && currentShareId && !isLocked && (
                    <Dialog
                      open={showPortionDialog?.itemId === item.id && showPortionDialog?.shareId === currentShareId}
                      onOpenChange={(open) => !open && setShowPortionDialog(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-zinc-700 text-xs"
                          onClick={() => setShowPortionDialog({ itemId: item.id, shareId: currentShareId })}
                        >
                          {currentClaim?.portion === 1 ? 'Full' : `${currentClaim?.portion}×`}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-zinc-900 border-zinc-800">
                        <DialogHeader>
                          <DialogTitle>Adjust Portion</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm text-zinc-400">
                            How much of &quot;{item.name}&quot; did you have?
                          </p>
                          <div className="space-y-2">
                            <Slider
                              defaultValue={[currentClaim?.portion || 1]}
                              min={0.25}
                              max={4}
                              step={0.25}
                              onValueCommit={([value]) => 
                                handlePortionChange(currentShareId, item.id, value)
                              }
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-zinc-500">
                              <span>1/4</span>
                              <span>1</span>
                              <span>2</span>
                              <span>3</span>
                              <span>4</span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {[0.5, 1, 2, 3].map((p) => (
                              <Button
                                key={p}
                                variant="outline"
                                size="sm"
                                onClick={() => handlePortionChange(currentShareId, item.id, p)}
                                className={`
                                  border-zinc-700
                                  ${currentClaim?.portion === p ? 'bg-emerald-600 border-emerald-600' : ''}
                                `}
                              >
                                {p === 1 ? 'Full' : `${p}×`}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  <span className="font-semibold text-emerald-400">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                  
                  {/* Delete button for creator */}
                  {canModifyItems && onRemoveItem && (
                    <button
                      onClick={() => setShowDeleteItemDialog({ id: item.id, name: item.name })}
                      className="ml-2 p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove item"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Delete Item Confirmation Dialog */}
      <Dialog open={!!showDeleteItemDialog} onOpenChange={(open) => !open && setShowDeleteItemDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Remove Item</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to remove &quot;{showDeleteItemDialog?.name}&quot; from the bill? 
              This will also remove all claims for this item.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteItemDialog(null)}
              className="border-zinc-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (showDeleteItemDialog && onRemoveItem) {
                  onRemoveItem(showDeleteItemDialog.id);
                  setShowDeleteItemDialog(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

