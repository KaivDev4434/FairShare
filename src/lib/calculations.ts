/**
 * Bill Splitting Calculation Engine
 * 
 * Handles fair distribution of costs including:
 * - Equal splits among claimants
 * - Custom portions (e.g., someone had 2 of 4 beers)
 * - Proportional tax/tip distribution
 * - Fair penny distribution using Largest Remainder Method
 */

interface Item {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Claim {
  shareId: string;
  itemId: string;
  portion: number; // 1 = full share, 0.5 = half share, etc.
}

interface Share {
  id: string;
  name: string;
}

interface BillWithDetails {
  items: Item[];
  shares: Share[];
  claims: Claim[];
  taxAmount: number;
  tipAmount: number;
  subtotal: number;
  total: number;
}

export interface PersonTotal {
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
    sharedWith: number; // Number of people sharing this item
  }[];
}

/**
 * Distribute pennies fairly using the Largest Remainder Method
 * This ensures the sum of rounded values equals the target total
 */
function distributeRemainder(
  values: { index: number; exact: number }[],
  targetTotal: number
): number[] {
  if (values.length === 0) return [];
  
  // Convert to cents for precise integer math
  const targetCents = Math.round(targetTotal * 100);
  
  // Floor all values and track remainders
  const floored = values.map(v => ({
    index: v.index,
    cents: Math.floor(v.exact * 100),
    remainder: (v.exact * 100) - Math.floor(v.exact * 100),
  }));
  
  // Calculate how many pennies we need to distribute
  const flooredSum = floored.reduce((sum, v) => sum + v.cents, 0);
  let penniesToDistribute = targetCents - flooredSum;
  
  // Sort by remainder (descending) to give pennies to those with largest remainders
  const sortedByRemainder = [...floored].sort((a, b) => b.remainder - a.remainder);
  
  // Distribute pennies one at a time to those with largest remainders
  for (const item of sortedByRemainder) {
    if (penniesToDistribute <= 0) break;
    const original = floored.find(f => f.index === item.index);
    if (original) {
      original.cents += 1;
      penniesToDistribute -= 1;
    }
  }
  
  // Convert back to dollars and return in original order
  const result = new Array(values.length).fill(0);
  for (const item of floored) {
    result[item.index] = item.cents / 100;
  }
  
  return result;
}

/**
 * Calculate how much each person owes for a bill
 */
export function calculateSplits(bill: BillWithDetails): PersonTotal[] {
  // Group claims by item to calculate total portions for each item
  const itemPortions: Record<string, number> = {};
  for (const claim of bill.claims) {
    if (!itemPortions[claim.itemId]) {
      itemPortions[claim.itemId] = 0;
    }
    itemPortions[claim.itemId] += claim.portion;
  }
  
  // First pass: calculate exact (unrounded) amounts for each person
  const exactResults: {
    share: Share;
    claims: Claim[];
    exactItemsTotal: number;
    exactTaxShare: number;
    exactTipShare: number;
    exactGrandTotal: number;
    itemBreakdown: PersonTotal['itemBreakdown'];
  }[] = [];
  
  const billSubtotal = bill.subtotal || bill.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  
  for (const share of bill.shares) {
    const shareClaims = bill.claims.filter(c => c.shareId === share.id);
    
    let exactItemsTotal = 0;
    const itemBreakdown: PersonTotal['itemBreakdown'] = [];
    
    for (const claim of shareClaims) {
      const item = bill.items.find(i => i.id === claim.itemId);
      if (!item) continue;
      
      const totalItemCost = item.price * item.quantity;
      const totalPortions = itemPortions[item.id] || 1;
      
      // Calculate this person's exact share of the item (no rounding yet)
      const amountOwed = (totalItemCost * claim.portion) / totalPortions;
      exactItemsTotal += amountOwed;
      
      // Count how many people are sharing this item
      const sharedWith = bill.claims.filter(c => c.itemId === item.id).length;
      
      itemBreakdown.push({
        itemId: item.id,
        itemName: item.name,
        itemPrice: item.price,
        portion: claim.portion,
        amountOwed: Math.round(amountOwed * 100) / 100, // Round for display
        sharedWith,
      });
    }
    
    // Calculate proportional tax and tip (exact values)
    const proportion = billSubtotal > 0 ? exactItemsTotal / billSubtotal : 0;
    const exactTaxShare = bill.taxAmount * proportion;
    const exactTipShare = bill.tipAmount * proportion;
    
    exactResults.push({
      share,
      claims: shareClaims,
      exactItemsTotal,
      exactTaxShare,
      exactTipShare,
      exactGrandTotal: exactItemsTotal + exactTaxShare + exactTipShare,
      itemBreakdown,
    });
  }
  
  // Calculate what the total should be (sum of claimed items + tax + tip)
  const totalClaimedItems = exactResults.reduce((sum, r) => sum + r.exactItemsTotal, 0);
  const targetTotal = totalClaimedItems + bill.taxAmount + bill.tipAmount;
  
  // Use Largest Remainder Method to distribute pennies fairly for grand totals
  const grandTotalValues = exactResults.map((r, i) => ({
    index: i,
    exact: r.exactGrandTotal,
  }));
  const distributedGrandTotals = distributeRemainder(grandTotalValues, targetTotal);
  
  // Build final results with fair penny distribution
  const results: PersonTotal[] = exactResults.map((r, i) => ({
    shareId: r.share.id,
    name: r.share.name,
    itemsTotal: Math.round(r.exactItemsTotal * 100) / 100,
    taxShare: Math.round(r.exactTaxShare * 100) / 100,
    tipShare: Math.round(r.exactTipShare * 100) / 100,
    grandTotal: distributedGrandTotals[i], // Use the fairly distributed total
    itemBreakdown: r.itemBreakdown,
  }));
  
  return results;
}

/**
 * Calculate running balances between roommates across multiple bills
 * Positive balance means the person is owed money
 * Negative balance means the person owes money
 */
export interface Balance {
  personName: string;
  amount: number; // Positive = owed, Negative = owes
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function calculateBalances(
  bills: { personTotals: PersonTotal[]; paidBy: string }[]
): Balance[] {
  const balances: Record<string, number> = {};
  
  for (const bill of bills) {
    const totalBill = bill.personTotals.reduce((sum, p) => sum + p.grandTotal, 0);
    
    for (const person of bill.personTotals) {
      if (!balances[person.name]) {
        balances[person.name] = 0;
      }
      
      // Each person owes their share
      balances[person.name] -= person.grandTotal;
    }
    
    // The person who paid is owed the total
    if (!balances[bill.paidBy]) {
      balances[bill.paidBy] = 0;
    }
    balances[bill.paidBy] += totalBill;
  }
  
  return Object.entries(balances).map(([name, amount]) => ({
    personName: name,
    amount: Math.round(amount * 100) / 100,
  }));
}

/**
 * Suggest optimal settlements to minimize transactions
 * Uses a greedy algorithm to pair up debtors and creditors
 */
export function suggestSettlements(balances: Balance[]): Settlement[] {
  const settlements: Settlement[] = [];
  
  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors = balances
    .filter(b => b.amount > 0.01)
    .map(b => ({ ...b }))
    .sort((a, b) => b.amount - a.amount);
  
  const debtors = balances
    .filter(b => b.amount < -0.01)
    .map(b => ({ ...b, amount: Math.abs(b.amount) }))
    .sort((a, b) => b.amount - a.amount);
  
  // Greedy matching
  let i = 0;
  let j = 0;
  
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    
    const amount = Math.min(creditor.amount, debtor.amount);
    
    if (amount > 0.01) {
      settlements.push({
        from: debtor.personName,
        to: creditor.personName,
        amount: Math.round(amount * 100) / 100,
      });
    }
    
    creditor.amount -= amount;
    debtor.amount -= amount;
    
    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }
  
  return settlements;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

