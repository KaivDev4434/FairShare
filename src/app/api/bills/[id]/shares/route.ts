import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

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
        user: {
          select: { id: true, name: true, email: true, image: true },
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
// For auth-required bills: auto-join when authenticated user accesses the bill
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const body = await request.json();
    const { name, amountPaid } = body;
    
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
    
    // For auth-required bills, user must be authenticated
    if (bill.requiresAuth && !session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required to join this bill' },
        { status: 401 }
      );
    }
    
    // Check if user already has a share in this bill (for auth-required bills)
    if (bill.requiresAuth && session?.user?.id) {
      const existingUserShare = await db.share.findFirst({
        where: { billId: id, userId: session.user.id },
      });
      if (existingUserShare) {
        return NextResponse.json(existingUserShare, { status: 200 });
      }
    }
    
    // Check if name already exists for this bill (case-insensitive check)
    const existingShares = await db.share.findMany({
      where: { billId: id },
    });
    const existingShare = existingShares.find(
      s => s.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingShare) {
      // For auth-required bills, if name exists but different user, append a number
      if (bill.requiresAuth && session?.user?.id && existingShare.userId !== session.user.id) {
        // Find a unique name
        let uniqueName = name.trim();
        let counter = 2;
        while (existingShares.find(s => s.name.toLowerCase() === uniqueName.toLowerCase())) {
          uniqueName = `${name.trim()} (${counter})`;
          counter++;
        }
        
        const share = await db.share.create({
          data: {
            name: uniqueName,
            billId: id,
            userId: session.user.id,
            amountPaid: amountPaid || 0,
          },
          include: {
            claims: true,
          },
        });
        
        return NextResponse.json(share, { status: 201 });
      }
      
      return NextResponse.json(
        { error: 'A person with this name already exists for this bill' },
        { status: 409 }
      );
    }
    
    // Link to user if logged in (for access management)
    const share = await db.share.create({
      data: {
        name: name.trim(),
        billId: id,
        userId: session?.user?.id || null,
        amountPaid: amountPaid || 0,
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

// PATCH /api/bills/[id]/shares - Update a share (e.g., amountPaid)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const body = await request.json();
    const { shareId, amountPaid } = body;
    
    if (!shareId) {
      return NextResponse.json(
        { error: 'shareId is required' },
        { status: 400 }
      );
    }
    
    // Get the share and bill
    const share = await db.share.findUnique({
      where: { id: shareId },
      include: { bill: true },
    });
    
    if (!share || share.billId !== id) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      );
    }
    
    if (share.bill.locked) {
      return NextResponse.json(
        { error: 'Bill is locked and cannot be modified' },
        { status: 403 }
      );
    }
    
    // For auth-required bills, only the share owner or bill creator can update
    if (share.bill.requiresAuth) {
      const isShareOwner = share.userId === session?.user?.id;
      const isBillCreator = share.bill.userId === session?.user?.id;
      
      if (!isShareOwner && !isBillCreator) {
        return NextResponse.json(
          { error: 'You can only update your own payment information' },
          { status: 403 }
        );
      }
    }
    
    // Validate payment amount
    if (amountPaid !== undefined) {
      if (typeof amountPaid !== 'number' || amountPaid < 0) {
        return NextResponse.json(
          { error: 'Payment amount must be a positive number' },
          { status: 400 }
        );
      }
      
      // Get total payments from all shares
      const allShares = await db.share.findMany({
        where: { billId: id },
      });
      
      const currentTotalPaid = allShares.reduce((sum, s) => {
        // Exclude the current share's old payment from the total
        if (s.id === shareId) return sum;
        return sum + (s.amountPaid || 0);
      }, 0);
      
      const newTotalPaid = currentTotalPaid + amountPaid;
      
      if (newTotalPaid > share.bill.total) {
        return NextResponse.json(
          { error: `Total payments (${newTotalPaid.toFixed(2)}) would exceed bill total (${share.bill.total.toFixed(2)})` },
          { status: 400 }
        );
      }
    }
    
    // Update the share
    const updatedShare = await db.share.update({
      where: { id: shareId },
      data: {
        amountPaid: amountPaid !== undefined ? amountPaid : share.amountPaid,
      },
      include: {
        claims: true,
      },
    });
    
    return NextResponse.json(updatedShare);
  } catch (error) {
    console.error('Error updating share:', error);
    return NextResponse.json(
      { error: 'Failed to update share' },
      { status: 500 }
    );
  }
}

// DELETE /api/bills/[id]/shares?shareId=xxx - Remove a share from a bill
// For auth-required bills: only the bill creator can remove people
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get('shareId');
    
    if (!shareId) {
      return NextResponse.json(
        { error: 'shareId is required' },
        { status: 400 }
      );
    }
    
    // Check if bill exists and get its details
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
    
    // For auth-required bills, only the creator can remove people
    if (bill.requiresAuth) {
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      if (bill.userId !== session.user.id) {
        return NextResponse.json(
          { error: 'Only the bill creator can remove participants' },
          { status: 403 }
        );
      }
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

