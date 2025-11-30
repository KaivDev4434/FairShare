'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface BillItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
}

interface ItemTableProps {
  items: BillItem[];
  editable?: boolean;
  onItemsChange?: (items: BillItem[]) => void;
  taxAmount?: number;
  tipAmount?: number;
  onTaxChange?: (tax: number) => void;
  onTipChange?: (tip: number) => void;
}

export function ItemTable({
  items,
  editable = false,
  onItemsChange,
  taxAmount = 0,
  tipAmount = 0,
  onTaxChange,
  onTipChange,
}: ItemTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal + taxAmount + tipAmount;

  const handleItemChange = (index: number, field: keyof BillItem, value: string | number) => {
    if (!onItemsChange) return;
    
    const newItems = [...items];
    if (field === 'price' || field === 'quantity') {
      newItems[index] = { ...newItems[index], [field]: Number(value) || 0 };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    onItemsChange(newItems);
  };

  const handleAddItem = () => {
    if (!onItemsChange) return;
    onItemsChange([...items, { name: 'New Item', price: 0, quantity: 1 }]);
    setEditingIndex(items.length);
  };

  const handleRemoveItem = (index: number) => {
    if (!onItemsChange) return;
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
    setEditingIndex(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Item</TableHead>
              <TableHead className="text-zinc-400 text-right w-24">Qty</TableHead>
              <TableHead className="text-zinc-400 text-right w-32">Price</TableHead>
              <TableHead className="text-zinc-400 text-right w-32">Total</TableHead>
              {editable && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index} className="border-zinc-800">
                <TableCell>
                  {editable && editingIndex === index ? (
                    <Input
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      onBlur={() => setEditingIndex(null)}
                      className="bg-zinc-900 border-zinc-700 h-8"
                      autoFocus
                    />
                  ) : (
                    <span
                      className={editable ? 'cursor-pointer hover:text-emerald-400' : ''}
                      onClick={() => editable && setEditingIndex(index)}
                    >
                      {item.name}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editable ? (
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="bg-zinc-900 border-zinc-700 h-8 w-16 text-right ml-auto"
                    />
                  ) : (
                    item.quantity
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editable ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                      className="bg-zinc-900 border-zinc-700 h-8 w-24 text-right ml-auto"
                    />
                  ) : (
                    formatCurrency(item.price)
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.price * item.quantity)}
                </TableCell>
                {editable && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                      className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={editable ? 5 : 4} className="text-center text-zinc-500 py-8">
                  No items yet. {editable && 'Click "Add Item" to get started.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totals Section */}
      <div className="rounded-lg border border-zinc-800 p-4 space-y-3">
        <div className="flex justify-between text-zinc-400">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Tax</span>
          {editable && onTaxChange ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={taxAmount}
              onChange={(e) => onTaxChange(Number(e.target.value) || 0)}
              className="bg-zinc-900 border-zinc-700 h-8 w-24 text-right"
            />
          ) : (
            <span className="text-zinc-400">{formatCurrency(taxAmount)}</span>
          )}
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Tip</span>
          {editable && onTipChange ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={tipAmount}
              onChange={(e) => onTipChange(Number(e.target.value) || 0)}
              className="bg-zinc-900 border-zinc-700 h-8 w-24 text-right"
            />
          ) : (
            <span className="text-zinc-400">{formatCurrency(tipAmount)}</span>
          )}
        </div>
        
        <div className="border-t border-zinc-800 pt-3 flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span className="text-emerald-400">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Add Item Button */}
      {editable && (
        <Button
          onClick={handleAddItem}
          variant="outline"
          className="w-full border-zinc-700 border-dashed hover:bg-zinc-800"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Item
        </Button>
      )}
    </div>
  );
}

