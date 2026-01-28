'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FileUpload } from '@/components/FileUpload';
import { ItemTable, BillItem } from '@/components/ItemTable';
import { DevDebugPanel } from '@/components/DevDebugPanel';
import { LandingPage } from '@/components/LandingPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { UserMenu } from '@/components/UserMenu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type Step = 'upload' | 'review' | 'payment' | 'success';

interface ParseDebugData {
  markdown?: string;
  data?: {
    items: Array<{ name: string; price: number; quantity: number }>;
    subtotal: number;
    tax: number;
    total: number;
  };
  error?: string;
  status?: number;
  timing?: {
    totalMs: number;
  };
}

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [step, setStep] = useState<Step>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [billName, setBillName] = useState('');
  const [items, setItems] = useState<BillItem[]>([]);
  const [taxAmount, setTaxAmount] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [createdBillId, setCreatedBillId] = useState<string | null>(null);
  const [createdBillTotal, setCreatedBillTotal] = useState(0);
  const [debugData, setDebugData] = useState<ParseDebugData | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [creatorShareId, setCreatorShareId] = useState<string | null>(null);

  // Show landing page if not authenticated and not a guest
  const showLandingPage = status !== 'loading' && !session && !isGuest;

  const handleGuestContinue = () => {
    setIsGuest(true);
  };

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    const startTime = Date.now();
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      const totalMs = Date.now() - startTime;
      
      // Always update debug data for dev panel
      setDebugData({
        markdown: result.markdown,
        data: result.data,
        error: result.error,
        status: response.status,
        timing: { totalMs },
      });
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse document');
      }
      
      if (result.data) {
        setItems(result.data.items || []);
        setTaxAmount(result.data.tax || 0);
        setTipAmount(0); // Usually not on receipts
        
        // Generate bill name from file name
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        setBillName(`${baseName} - ${date}`);
        
        setStep('review');
        toast.success('Bill parsed successfully!');
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse document');
      
      // Allow manual entry
      setItems([]);
      setBillName(`Bill - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
      setStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBill = async () => {
    if (!billName.trim()) {
      toast.error('Please enter a bill name');
      return;
    }
    
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    
    // Validate all items - check each item for all issues
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemNum = i + 1;
      
      // Check price first (most common user error when entering data)
      if (item.price < 0) {
        toast.error(`Item ${itemNum}: Price cannot be negative`);
        return;
      }
      
      // Check name
      if (!item.name.trim()) {
        toast.error(`Item ${itemNum}: Name is required`);
        return;
      }
      
      // Check quantity
      if (item.quantity < 1) {
        toast.error(`Item ${itemNum}: Quantity must be at least 1`);
        return;
      }
    }
    
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: billName,
          items,
          taxAmount,
          tipAmount,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create bill');
      }
      
      setCreatedBillId(result.id);
      setCreatedBillTotal(result.total || 0);
      
      // For authenticated users creating new bills, show payment dialog
      // For guests, skip to success
      if (session?.user?.id) {
        // Auto-join the bill as creator
        const shareResponse = await fetch(`/api/bills/${result.id}/shares`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: session.user.name || session.user.email?.split('@')[0] || 'Creator' 
          }),
        });
        
        if (shareResponse.ok) {
          const share = await shareResponse.json();
          setCreatorShareId(share.id);
          setPaymentAmount(result.total?.toString() || '0');
          setStep('payment');
        } else {
          setStep('success');
        }
      } else {
        setStep('success');
      }
      
      toast.success('Bill created!');
    } catch (error) {
      console.error('Create bill error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create bill');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSavePayment = async () => {
    if (!createdBillId || !creatorShareId) {
      setStep('success');
      return;
    }
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    try {
      await fetch(`/api/bills/${createdBillId}/shares`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: creatorShareId, amountPaid: amount }),
      });
      
      setStep('success');
      if (amount > 0) {
        toast.success('Payment recorded!');
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      setStep('success');
    }
  };

  const handleSkipPayment = () => {
    setStep('success');
  };

  const handleStartOver = () => {
    setStep('upload');
    setBillName('');
    setItems([]);
    setTaxAmount(0);
    setTipAmount(0);
    setCreatedBillId(null);
    setCreatedBillTotal(0);
    setPaymentAmount('');
    setCreatorShareId(null);
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const copyShareLink = () => {
    const link = `${window.location.origin}/bill/${createdBillId}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard!');
  };

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (showLandingPage) {
    return <LandingPage onGuestContinue={handleGuestContinue} />;
  }

  return (
    <main className="min-h-screen">
      {/* Developer Debug Panel - toggle with Ctrl+Shift+D */}
      <DevDebugPanel debugData={debugData} />
      
      {/* Header */}
      <header className="border-b border-zinc-800/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-shadow">
              <span className="text-lg font-bold">F</span>
            </div>
            <span className="text-xl font-semibold">FairShare</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </Button>
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section - only on upload step */}
        {step === 'upload' && (
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Split Bills Fairly
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Upload a receipt, select what each person had, and let FairShare calculate who owes what.
              No more awkward math at dinner.
            </p>
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {['Upload', 'Review', session ? 'Payment' : null, 'Share'].filter(Boolean).map((label, i, arr) => {
            const steps = session ? ['upload', 'review', 'payment', 'success'] : ['upload', 'review', 'success'];
            const stepIndex = steps.indexOf(step);
            const isActive = i === stepIndex;
            const isComplete = i < stepIndex;
            
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                    ${isComplete ? 'bg-emerald-600 text-white' : ''}
                    ${isActive ? 'bg-emerald-600 text-white ring-4 ring-emerald-600/20' : ''}
                    ${!isActive && !isComplete ? 'bg-zinc-800 text-zinc-500' : ''}
                  `}
                >
                  {isComplete ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`text-sm ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                  {label}
                </span>
                {i < arr.length - 1 && (
                  <div className={`w-12 h-0.5 ${i < stepIndex ? 'bg-emerald-600' : 'bg-zinc-800'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-6 animate-fade-in">
            <FileUpload onFileSelect={handleFileSelect} isLoading={isProcessing} />
            
            <div className="text-center">
              <span className="text-zinc-500 text-sm">or</span>
            </div>
            
            <Button
              variant="outline"
              className="w-full border-zinc-700 hover:bg-zinc-800"
              onClick={() => {
                setBillName(`Bill - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
                setStep('review');
              }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Enter Items Manually
            </Button>
          </div>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <div className="space-y-6 animate-fade-in">
            <Card className="p-6 bg-zinc-900/50 border-zinc-800">
              <label className="block text-sm text-zinc-400 mb-2">Bill Name</label>
              <Input
                value={billName}
                onChange={(e) => setBillName(e.target.value)}
                placeholder="e.g., Costco Run - Nov 30"
                className="bg-zinc-800 border-zinc-700 text-lg"
              />
            </Card>

            <ItemTable
              items={items}
              editable
              onItemsChange={setItems}
              taxAmount={taxAmount}
              tipAmount={tipAmount}
              onTaxChange={setTaxAmount}
              onTipChange={setTipAmount}
            />

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={handleStartOver}
                className="border-zinc-700"
              >
                Start Over
              </Button>
              <Button
                onClick={handleCreateBill}
                disabled={isProcessing || items.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Bill & Share
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Payment Step - For authenticated users only */}
        {step === 'payment' && createdBillId && session && (
          <div className="text-center space-y-6 animate-fade-in max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold mb-2">Record Your Payment</h2>
              <p className="text-zinc-400">
                How much did you pay for this bill? This helps calculate who owes whom.
              </p>
            </div>

            <Card className="p-6 bg-zinc-900/50 border-zinc-800 text-left">
              <div className="mb-4">
                <p className="text-sm text-zinc-400 mb-1">Bill Total</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(createdBillTotal)}</p>
              </div>
              
              <label className="block text-sm text-zinc-400 mb-2">Amount you paid</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-lg mb-4"
              />
              
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentAmount(createdBillTotal.toString())}
                  className="border-zinc-700"
                >
                  Full Amount
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentAmount((createdBillTotal / 2).toFixed(2))}
                  className="border-zinc-700"
                >
                  Half
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentAmount('0')}
                  className="border-zinc-700"
                >
                  None
                </Button>
              </div>
            </Card>

            <div className="flex gap-4 justify-center">
              <Button
                variant="outline"
                onClick={handleSkipPayment}
                className="border-zinc-700"
              >
                Skip for now
              </Button>
              <Button
                onClick={handleSavePayment}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Save & Continue
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && createdBillId && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold mb-2">Bill Created!</h2>
              <p className="text-zinc-400">Share the link below with your roommates</p>
            </div>

            <Card className="p-4 bg-zinc-900/50 border-zinc-800">
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/bill/${createdBillId}`}
                  className="bg-zinc-800 border-zinc-700 font-mono text-sm"
                />
                <Button onClick={copyShareLink} className="bg-emerald-600 hover:bg-emerald-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </Button>
              </div>
            </Card>

            <div className="flex gap-4 justify-center">
              <Button
                variant="outline"
                onClick={handleStartOver}
                className="border-zinc-700"
              >
                Create Another Bill
              </Button>
              <Button
                onClick={() => router.push(`/bill/${createdBillId}`)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                View Bill
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
