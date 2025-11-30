import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/bills/[id]/shares - Get all shares for a bill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const shares = await db.share.findMany({
      where: { billId: id },
      include: {
        claims: {
          include: {
            item: true,
          },
        },
      },
    });
    
    return NextResponse.json(shares);
  } catch (error) {
    console.error('Error fetching shares:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shares' },
      { status: 500 }
    );
  }
}

// POST /api/bills/[id]/shares - Add a new share (person) to a bill
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    // Check if bill exists and is not locked
    const bill = await db.bill.findUnique({ where: { id } });
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
    
    // Check if name already exists for this bill (case-insensitive check)
    const existingShares = await db.share.findMany({
      where: { billId: id },
    });
    const existingShare = existingShares.find(
      s => s.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingShare) {
      return NextResponse.json(
        { error: 'A person with this name already exists for this bill' },
        { status: 409 }
      );
    }
    
    const share = await db.share.create({
      data: {
        name: name.trim(),
        billId: id,
      },
      include: {
        claims: true,
      },
    });
    
    return NextResponse.json(share, { status: 201 });
  } catch (error) {
    console.error('Error creating share:', error);
    return NextResponse.json(
      { error: 'Failed to create share' },
      { status: 500 }
    );
  }
}

// DELETE /api/bills/[id]/shares?shareId=xxx - Remove a share from a bill
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get('shareId');
    
    if (!shareId) {
      return NextResponse.json(
        { error: 'shareId is required' },
        { status: 400 }
      );
    }
    
    // Check if bill is locked
    const bill = await db.bill.findUnique({ where: { id } });
    if (bill?.locked) {
      return NextResponse.json(
        { error: 'Bill is locked and cannot be modified' },
        { status: 403 }
      );
    }
    
    await db.share.delete({
      where: { id: shareId },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting share:', error);
    return NextResponse.json(
      { error: 'Failed to delete share' },
      { status: 500 }
    );
  }
}

