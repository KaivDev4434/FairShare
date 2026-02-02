import { describe, it, expect } from 'vitest';
import {
    calculateSplits,
    calculateBillBalances,
    suggestSettlements,
    formatCurrency,
    PersonTotal,
} from './calculations';

describe('calculateSplits', () => {
    // Helper to create a basic bill structure
    const createBill = (overrides = {}) => ({
        items: [],
        shares: [],
        claims: [],
        taxAmount: 0,
        tipAmount: 0,
        subtotal: 0,
        total: 0,
        ...overrides,
    });

    describe('Issue #9: Users with no claims should show $0.00', () => {
        it('should return $0.00 for a user who has not claimed any items', () => {
            const bill = createBill({
                items: [
                    { id: 'item1', name: 'Pizza', price: 20.00, quantity: 1 },
                ],
                shares: [
                    { id: 'share1', name: 'Alice' },
                    { id: 'share2', name: 'Bob' }, // Bob hasn't claimed anything
                ],
                claims: [
                    { shareId: 'share1', itemId: 'item1', portion: 1 },
                ],
                taxAmount: 2.00,
                tipAmount: 0,
                subtotal: 20.00,
                total: 22.00,
            });

            const splits = calculateSplits(bill);

            const alice = splits.find(s => s.name === 'Alice');
            const bob = splits.find(s => s.name === 'Bob');

            expect(alice?.grandTotal).toBe(22.00);
            expect(bob?.grandTotal).toBe(0); // Bob should have exactly $0.00
            expect(bob?.itemsTotal).toBe(0);
            expect(bob?.taxShare).toBe(0);
            expect(bob?.tipShare).toBe(0);
        });

        it('should return $0.00 for all users when no one has claimed anything', () => {
            const bill = createBill({
                items: [
                    { id: 'item1', name: 'Pizza', price: 20.00, quantity: 1 },
                ],
                shares: [
                    { id: 'share1', name: 'Alice' },
                    { id: 'share2', name: 'Bob' },
                ],
                claims: [], // No claims
                taxAmount: 2.00,
                tipAmount: 0,
                subtotal: 20.00,
                total: 22.00,
            });

            const splits = calculateSplits(bill);

            expect(splits.every(s => s.grandTotal === 0)).toBe(true);
        });

        it('should not give stray pennies to users with no claims', () => {
            // This is a regression test for issue #9
            // With problematic floating point math, users could receive $0.01
            const bill = createBill({
                items: [
                    { id: 'item1', name: 'Item A', price: 10.33, quantity: 1 },
                    { id: 'item2', name: 'Item B', price: 15.67, quantity: 1 },
                ],
                shares: [
                    { id: 'share1', name: 'Alice' },
                    { id: 'share2', name: 'Bob' },
                    { id: 'share3', name: 'Charlie' }, // Charlie hasn't claimed anything
                ],
                claims: [
                    { shareId: 'share1', itemId: 'item1', portion: 1 },
                    { shareId: 'share2', itemId: 'item2', portion: 1 },
                ],
                taxAmount: 3.00,
                tipAmount: 2.00,
                subtotal: 26.00,
                total: 31.00,
            });

            const splits = calculateSplits(bill);

            const charlie = splits.find(s => s.name === 'Charlie');
            expect(charlie?.grandTotal).toBe(0); // Must be exactly 0, not 0.01
        });
    });

    describe('Basic splitting functionality', () => {
        it('should split a bill equally between two people', () => {
            const bill = createBill({
                items: [
                    { id: 'item1', name: 'Pizza', price: 20.00, quantity: 1 },
                ],
                shares: [
                    { id: 'share1', name: 'Alice' },
                    { id: 'share2', name: 'Bob' },
                ],
                claims: [
                    { shareId: 'share1', itemId: 'item1', portion: 1 },
                    { shareId: 'share2', itemId: 'item1', portion: 1 },
                ],
                taxAmount: 0,
                tipAmount: 0,
                subtotal: 20.00,
                total: 20.00,
            });

            const splits = calculateSplits(bill);

            expect(splits.length).toBe(2);
            expect(splits[0].grandTotal).toBe(10.00);
            expect(splits[1].grandTotal).toBe(10.00);
        });

        it('should handle one person claiming everything', () => {
            const bill = createBill({
                items: [
                    { id: 'item1', name: 'Pizza', price: 25.00, quantity: 1 },
                ],
                shares: [
                    { id: 'share1', name: 'Alice' },
                ],
                claims: [
                    { shareId: 'share1', itemId: 'item1', portion: 1 },
                ],
                taxAmount: 2.50,
                tipAmount: 5.00,
                subtotal: 25.00,
                total: 32.50,
            });

            const splits = calculateSplits(bill);

            expect(splits.length).toBe(1);
            expect(splits[0].grandTotal).toBe(32.50);
            expect(splits[0].taxShare).toBe(2.50);
            expect(splits[0].tipShare).toBe(5.00);
        });
    });

    describe('Penny distribution (Largest Remainder Method)', () => {
        it('should handle odd splits with penny-perfect distribution', () => {
            // $10 split 3 ways = $3.33, $3.33, $3.34
            const bill = createBill({
                items: [
                    { id: 'item1', name: 'Pizza', price: 10.00, quantity: 1 },
                ],
                shares: [
                    { id: 'share1', name: 'Alice' },
                    { id: 'share2', name: 'Bob' },
                    { id: 'share3', name: 'Charlie' },
                ],
                claims: [
                    { shareId: 'share1', itemId: 'item1', portion: 1 },
                    { shareId: 'share2', itemId: 'item1', portion: 1 },
                    { shareId: 'share3', itemId: 'item1', portion: 1 },
                ],
                taxAmount: 0,
                tipAmount: 0,
                subtotal: 10.00,
                total: 10.00,
            });

            const splits = calculateSplits(bill);
            const total = splits.reduce((sum, s) => sum + s.grandTotal, 0);

            // The sum should be exactly $10.00
            expect(Math.round(total * 100) / 100).toBe(10.00);

            // Each person should owe between $3.33 and $3.34
            splits.forEach(s => {
                expect(s.grandTotal).toBeGreaterThanOrEqual(3.33);
                expect(s.grandTotal).toBeLessThanOrEqual(3.34);
            });
        });

        it('should distribute tax and tip proportionally', () => {
            const bill = createBill({
                items: [
                    { id: 'item1', name: 'Cheap item', price: 10.00, quantity: 1 },
                    { id: 'item2', name: 'Expensive item', price: 40.00, quantity: 1 },
                ],
                shares: [
                    { id: 'share1', name: 'Alice' }, // Claims cheap item (20% of subtotal)
                    { id: 'share2', name: 'Bob' },   // Claims expensive item (80% of subtotal)
                ],
                claims: [
                    { shareId: 'share1', itemId: 'item1', portion: 1 },
                    { shareId: 'share2', itemId: 'item2', portion: 1 },
                ],
                taxAmount: 5.00,   // 10% tax
                tipAmount: 10.00,  // 20% tip
                subtotal: 50.00,
                total: 65.00,
            });

            const splits = calculateSplits(bill);

            const alice = splits.find(s => s.name === 'Alice')!;
            const bob = splits.find(s => s.name === 'Bob')!;

            // Alice's proportional share: 10/50 = 20%
            expect(alice.itemsTotal).toBe(10.00);
            expect(alice.taxShare).toBe(1.00);   // 20% of $5
            expect(alice.tipShare).toBe(2.00);   // 20% of $10

            // Bob's proportional share: 40/50 = 80%
            expect(bob.itemsTotal).toBe(40.00);
            expect(bob.taxShare).toBe(4.00);     // 80% of $5
            expect(bob.tipShare).toBe(8.00);     // 80% of $10

            // Total should equal bill total
            const total = alice.grandTotal + bob.grandTotal;
            expect(Math.round(total * 100) / 100).toBe(65.00);
        });
    });

    describe('Portion handling', () => {
        it('should handle custom portions correctly', () => {
            // Alice had 2 beers, Bob had 1 beer (out of 3 total at $15)
            const bill = createBill({
                items: [
                    { id: 'item1', name: 'Beer', price: 5.00, quantity: 3 },
                ],
                shares: [
                    { id: 'share1', name: 'Alice' },
                    { id: 'share2', name: 'Bob' },
                ],
                claims: [
                    { shareId: 'share1', itemId: 'item1', portion: 2 }, // Alice: 2 beers
                    { shareId: 'share2', itemId: 'item1', portion: 1 }, // Bob: 1 beer
                ],
                taxAmount: 0,
                tipAmount: 0,
                subtotal: 15.00,
                total: 15.00,
            });

            const splits = calculateSplits(bill);

            const alice = splits.find(s => s.name === 'Alice')!;
            const bob = splits.find(s => s.name === 'Bob')!;

            // Total $15, Alice has 2/3 portions = $10, Bob has 1/3 = $5
            expect(alice.grandTotal).toBe(10.00);
            expect(bob.grandTotal).toBe(5.00);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty bill with no shares', () => {
            const bill = createBill({
                items: [{ id: 'item1', name: 'Pizza', price: 20.00, quantity: 1 }],
                shares: [],
                claims: [],
                subtotal: 20.00,
                total: 22.00,
            });

            const splits = calculateSplits(bill);
            expect(splits).toEqual([]);
        });

        it('should handle bill with zero total', () => {
            const bill = createBill({
                items: [{ id: 'item1', name: 'Free item', price: 0, quantity: 1 }],
                shares: [{ id: 'share1', name: 'Alice' }],
                claims: [{ shareId: 'share1', itemId: 'item1', portion: 1 }],
                subtotal: 0,
                total: 0,
            });

            const splits = calculateSplits(bill);
            expect(splits[0].grandTotal).toBe(0);
        });
    });
});

describe('calculateBillBalances', () => {
    it('should calculate correct balances when one person pays the full bill', () => {
        const personTotals: PersonTotal[] = [
            { shareId: '1', name: 'Alice', itemsTotal: 15, taxShare: 1.5, tipShare: 0, grandTotal: 16.5, itemBreakdown: [] },
            { shareId: '2', name: 'Bob', itemsTotal: 15, taxShare: 1.5, tipShare: 0, grandTotal: 16.5, itemBreakdown: [] },
        ];

        const payments = [{ name: 'Alice', amount: 33 }];

        const balances = calculateBillBalances(personTotals, payments);

        const alice = balances.find(b => b.personName === 'Alice')!;
        const bob = balances.find(b => b.personName === 'Bob')!;

        // Alice paid $33, owes $16.50 → net +$16.50 (is owed)
        expect(alice.amount).toBe(16.5);
        // Bob paid $0, owes $16.50 → net -$16.50 (owes)
        expect(bob.amount).toBe(-16.5);
    });
});

describe('suggestSettlements', () => {
    it('should suggest correct settlement for simple debt', () => {
        const balances = [
            { personName: 'Alice', amount: 16.5 },  // Is owed $16.50
            { personName: 'Bob', amount: -16.5 },   // Owes $16.50
        ];

        const settlements = suggestSettlements(balances);

        expect(settlements.length).toBe(1);
        expect(settlements[0].from).toBe('Bob');
        expect(settlements[0].to).toBe('Alice');
        expect(settlements[0].amount).toBe(16.5);
    });

    it('should handle multiple debts with minimal transactions', () => {
        const balances = [
            { personName: 'Alice', amount: 30 },    // Is owed $30
            { personName: 'Bob', amount: -20 },     // Owes $20
            { personName: 'Charlie', amount: -10 }, // Owes $10
        ];

        const settlements = suggestSettlements(balances);

        // Should have 2 settlements: Bob→Alice $20, Charlie→Alice $10
        expect(settlements.length).toBe(2);

        const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);
        expect(totalSettled).toBe(30);
    });

    it('should not suggest settlements for tiny amounts', () => {
        const balances = [
            { personName: 'Alice', amount: 0.005 },
            { personName: 'Bob', amount: -0.005 },
        ];

        const settlements = suggestSettlements(balances);

        // Amounts less than $0.01 should be ignored
        expect(settlements.length).toBe(0);
    });
});

describe('formatCurrency', () => {
    it('should format positive amounts correctly', () => {
        expect(formatCurrency(10)).toBe('$10.00');
        expect(formatCurrency(10.5)).toBe('$10.50');
        expect(formatCurrency(10.99)).toBe('$10.99');
    });

    it('should format zero correctly', () => {
        expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format negative amounts correctly', () => {
        expect(formatCurrency(-10.50)).toBe('-$10.50');
    });
});
