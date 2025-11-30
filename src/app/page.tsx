'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileUpload } from '@/components/FileUpload';
import { ItemTable, BillItem } from '@/components/ItemTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

type Step = 'upload' | 'review' | 'success';

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [billName, setBillName] = useState('');
  const [items, setItems] = useState<BillItem[]>([]);
  const [taxAmount, setTaxAmount] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [createdBillId, setCreatedBillId] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
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
      setStep('success');
      toast.success('Bill created!');
    } catch (error) {
      console.error('Create bill error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create bill');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartOver = () => {
    setStep('upload');
    setBillName('');
    setItems([]);
    setTaxAmount(0);
    setTipAmount(0);
    setCreatedBillId(null);
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/bill/${createdBillId}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard!');
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-800/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <span className="text-lg font-bold">F</span>
            </div>
            <span className="text-xl font-semibold">FairShare</span>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </Button>
          </Link>
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
          {['Upload', 'Review', 'Share'].map((label, i) => {
            const stepIndex = ['upload', 'review', 'success'].indexOf(step);
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
                {i < 2 && (
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
