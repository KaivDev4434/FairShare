import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateSplits, PersonTotal } from '@/lib/calculations';

// GET /api/bills/[id]/calculate - Calculate splits for a bill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        items: true,
        shares: {
          include: {
            claims: true,
          },
        },
      },
    });
    
    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }
    
    // Flatten claims for calculation
    const allClaims = bill.shares.flatMap((share: { id: string; claims: { itemId: string; portion: number }[] }) =>
      share.claims.map((claim: { itemId: string; portion: number }) => ({
        shareId: share.id,
        itemId: claim.itemId,
        portion: claim.portion,
      }))
    );
    
    const splits: PersonTotal[] = calculateSplits({
      items: bill.items.map((i: { id: string; name: string; price: number; quantity: number }) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      shares: bill.shares.map((s: { id: string; name: string }) => ({
        id: s.id,
        name: s.name,
      })),
      claims: allClaims,
      taxAmount: bill.taxAmount,
      tipAmount: bill.tipAmount,
      subtotal: bill.subtotal,
      total: bill.total,
    });
    
    // Calculate totals
    const totalClaimed = splits.reduce((sum, p) => sum + p.grandTotal, 0);
    const unclaimed = bill.total - totalClaimed;
    
    return NextResponse.json({
      billId: bill.id,
      billName: bill.name,
      billTotal: bill.total,
      splits,
      summary: {
        totalClaimed: Math.round(totalClaimed * 100) / 100,
        unclaimed: Math.round(unclaimed * 100) / 100,
        itemCount: bill.items.length,
        personCount: bill.shares.length,
      },
    });
  } catch (error) {
    console.error('Error calculating splits:', error);
    return NextResponse.json(
      { error: 'Failed to calculate splits' },
      { status: 500 }
    );
  }
}

