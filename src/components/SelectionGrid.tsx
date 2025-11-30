'use client';

import { useState, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Item {
  id: string;
  name: string;
  price: number;
  quantity: number;
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
  isLocked?: boolean;
}

export function SelectionGrid({
  items,
  shares,
  claims,
  currentShareId,
  onClaimChange,
  onAddShare,
  onRemoveShare,
  isLocked = false,
}: SelectionGridProps) {
  const [newPersonName, setNewPersonName] = useState('');
  const [showPortionDialog, setShowPortionDialog] = useState<{ itemId: string; shareId: string } | null>(null);

  const getClaim = useCallback((shareId: string, itemId: string): Claim | undefined => {
    return claims.find(c => c.shareId === shareId && c.itemId === itemId);
  }, [claims]);

  const getItemClaimants = useCallback((itemId: string): string[] => {
    return claims
      .filter(c => c.itemId === itemId && c.portion > 0)
      .map(c => shares.find(s => s.id === c.shareId)?.name || 'Unknown');
  }, [claims, shares]);

  const handleAddPerson = () => {
    if (newPersonName.trim()) {
      onAddShare(newPersonName.trim());
      setNewPersonName('');
    }
  };

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

  // Check if current user has any claims for an item
  const isItemSelectedByCurrentUser = useCallback((itemId: string): boolean => {
    if (!currentShareId) return false;
    const claim = getClaim(currentShareId, itemId);
    return claim !== undefined && claim.portion > 0;
  }, [currentShareId, getClaim]);

  return (
    <div className="space-y-6">
      {/* People Pills */}
      <div className="flex flex-wrap gap-2 items-center">
        {shares.map((share) => (
          <Badge
            key={share.id}
            variant={currentShareId === share.id ? 'default' : 'outline'}
            className={`
              text-sm py-1.5 px-3 cursor-pointer transition-all
              ${currentShareId === share.id 
                ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600' 
                : 'border-zinc-700 hover:border-zinc-500'
              }
            `}
          >
            {share.name}
            {!isLocked && shares.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveShare(share.id);
                }}
                className="ml-2 hover:text-red-400"
              >
                ×
              </button>
            )}
          </Badge>
        ))}
        
        {!isLocked && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-dashed border-zinc-700">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Person
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle>Add a Person</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter name..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
                  className="bg-zinc-800 border-zinc-700"
                />
                <Button onClick={handleAddPerson} className="bg-emerald-600 hover:bg-emerald-700">
                  Add
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

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
                    <p className="font-medium">{item.name}</p>
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
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

