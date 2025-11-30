import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/bills/[id]/claims - Create or update a claim
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;
    const body = await request.json();
    const { shareId, itemId, portion = 1 } = body;
    
    if (!shareId || !itemId) {
      return NextResponse.json(
        { error: 'shareId and itemId are required' },
        { status: 400 }
      );
    }
    
    // Validate portion
    if (typeof portion !== 'number' || portion < 0 || portion > 10) {
      return NextResponse.json(
        { error: 'Portion must be a number between 0 and 10' },
        { status: 400 }
      );
    }
    
    // Check if bill exists and is not locked
    const bill = await db.bill.findUnique({
      where: { id: billId },
      include: { items: true, shares: true },
    });
    
    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }
    
    if (bill.locked) {
      return NextResponse.json(
        { error: 'Bill is locked and cannot be modified' },
        { status: 403 }
      );
    }
    
    // Verify item belongs to this bill
    const itemBelongsToBill = bill.items.some((i: { id: string }) => i.id === itemId);
    if (!itemBelongsToBill) {
      return NextResponse.json(
        { error: 'Item does not belong to this bill' },
        { status: 400 }
      );
    }
    
    // Verify share belongs to this bill
    const shareBelongsToBill = bill.shares.some((s: { id: string }) => s.id === shareId);
    if (!shareBelongsToBill) {
      return NextResponse.json(
        { error: 'Share does not belong to this bill' },
        { status: 400 }
      );
    }
    
    // Upsert the claim (create or update)
    const claim = await db.claim.upsert({
      where: {
        shareId_itemId: { shareId, itemId },
      },
      update: { portion },
      create: { shareId, itemId, portion },
      include: {
        share: true,
        item: true,
      },
    });
    
    return NextResponse.json(claim);
  } catch (error) {
    console.error('Error creating/updating claim:', error);
    return NextResponse.json(
      { error: 'Failed to create/update claim' },
      { status: 500 }
    );
  }
}

// DELETE /api/bills/[id]/claims - Remove a claim
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;
    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get('shareId');
    const itemId = searchParams.get('itemId');
    
    if (!shareId || !itemId) {
      return NextResponse.json(
        { error: 'shareId and itemId are required' },
        { status: 400 }
      );
    }
    
    // Check if bill is locked
    const bill = await db.bill.findUnique({ where: { id: billId } });
    if (bill?.locked) {
      return NextResponse.json(
        { error: 'Bill is locked and cannot be modified' },
        { status: 403 }
      );
    }
    
    await db.claim.delete({
      where: {
        shareId_itemId: { shareId, itemId },
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting claim:', error);
    return NextResponse.json(
      { error: 'Failed to delete claim' },
      { status: 500 }
    );
  }
}

// PATCH /api/bills/[id]/claims - Batch update claims for a share
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;
    const body = await request.json();
    const { shareId, claims } = body;
    
    if (!shareId || !Array.isArray(claims)) {
      return NextResponse.json(
        { error: 'shareId and claims array are required' },
        { status: 400 }
      );
    }
    
    // Check if bill is locked
    const bill = await db.bill.findUnique({ where: { id: billId } });
    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }
    
    if (bill.locked) {
      return NextResponse.json(
        { error: 'Bill is locked and cannot be modified' },
        { status: 403 }
      );
    }
    
    // Delete all existing claims for this share
    await db.claim.deleteMany({
      where: { shareId },
    });
    
    // Create new claims
    const newClaims = await db.claim.createMany({
      data: claims
        .filter((c: { itemId: string; portion?: number }) => c.portion !== 0)
        .map((c: { itemId: string; portion?: number }) => ({
          shareId,
          itemId: c.itemId,
          portion: c.portion || 1,
        })),
    });
    
    return NextResponse.json({ success: true, count: newClaims.count });
  } catch (error) {
    console.error('Error batch updating claims:', error);
    return NextResponse.json(
      { error: 'Failed to update claims' },
      { status: 500 }
    );
  }
}

