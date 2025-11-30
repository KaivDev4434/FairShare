/**
 * Bill Splitting Calculation Engine
 * 
 * Handles fair distribution of costs including:
 * - Equal splits among claimants
 * - Custom portions (e.g., someone had 2 of 4 beers)
 * - Proportional tax/tip distribution
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
 * Calculate how much each person owes for a bill
 */
export function calculateSplits(bill: BillWithDetails): PersonTotal[] {
  const results: PersonTotal[] = [];
  
  // Group claims by item to calculate total portions for each item
  const itemPortions: Record<string, number> = {};
  for (const claim of bill.claims) {
    if (!itemPortions[claim.itemId]) {
      itemPortions[claim.itemId] = 0;
    }
    itemPortions[claim.itemId] += claim.portion;
  }
  
  // Calculate each person's total
  for (const share of bill.shares) {
    const shareClaims = bill.claims.filter(c => c.shareId === share.id);
    
    let itemsTotal = 0;
    const itemBreakdown: PersonTotal['itemBreakdown'] = [];
    
    for (const claim of shareClaims) {
      const item = bill.items.find(i => i.id === claim.itemId);
      if (!item) continue;
      
      const totalItemCost = item.price * item.quantity;
      const totalPortions = itemPortions[item.id] || 1;
      
      // Calculate this person's share of the item
      const amountOwed = (totalItemCost * claim.portion) / totalPortions;
      itemsTotal += amountOwed;
      
      // Count how many people are sharing this item
      const sharedWith = bill.claims.filter(c => c.itemId === item.id).length;
      
      itemBreakdown.push({
        itemId: item.id,
        itemName: item.name,
        itemPrice: item.price,
        portion: claim.portion,
        amountOwed: Math.round(amountOwed * 100) / 100,
        sharedWith,
      });
    }
    
    // Calculate proportional tax and tip based on items total
    // This ensures people who ordered more expensive items pay proportionally more tax/tip
    const billSubtotal = bill.subtotal || bill.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const proportion = billSubtotal > 0 ? itemsTotal / billSubtotal : 0;
    
    const taxShare = bill.taxAmount * proportion;
    const tipShare = bill.tipAmount * proportion;
    
    results.push({
      shareId: share.id,
      name: share.name,
      itemsTotal: Math.round(itemsTotal * 100) / 100,
      taxShare: Math.round(taxShare * 100) / 100,
      tipShare: Math.round(tipShare * 100) / 100,
      grandTotal: Math.round((itemsTotal + taxShare + tipShare) * 100) / 100,
      itemBreakdown,
    });
  }
  
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

