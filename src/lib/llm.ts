/**
 * LLM Client with Ollama (primary) and Perplexity (fallback)
 * 
 * Uses a hybrid approach to minimize API costs while maintaining reliability:
 * 1. Try Ollama first (free, local)
 * 2. If Ollama fails validation, retry with Perplexity (paid, more reliable)
 */

export interface BillItem {
  name: string;
  price: number;
  quantity: number;
}

export interface BillData {
  items: BillItem[];
  subtotal: number;
  tax: number;
  total: number;
}

const EXTRACTION_PROMPT = `Extract all items and prices from this bill as JSON.
Be precise with prices - include cents.
If quantity is not specified, assume 1.
Only include actual purchasable items, not headers or categories.

Bill content:
{MARKDOWN}

Return ONLY valid JSON in this exact format, no markdown code blocks:
{
  "items": [{"name": "string", "price": number, "quantity": number}],
  "subtotal": number,
  "tax": number,
  "total": number
}`;

/**
 * Validate extracted bill data
 */
function validateBillData(data: unknown): data is BillData {
  if (!data || typeof data !== 'object') return false;
  
  const bill = data as Record<string, unknown>;
  
  // Must have items array
  if (!Array.isArray(bill.items) || bill.items.length === 0) return false;
  
  // Each item must have name (string) and price (number)
  for (const item of bill.items) {
    if (typeof item !== 'object' || item === null) return false;
    const i = item as Record<string, unknown>;
    if (typeof i.name !== 'string' || i.name.trim() === '') return false;
    if (typeof i.price !== 'number' || isNaN(i.price)) return false;
    if (i.quantity !== undefined && (typeof i.quantity !== 'number' || isNaN(i.quantity))) return false;
  }
  
  // Subtotal, tax, total should be numbers (can be 0)
  if (typeof bill.subtotal !== 'number') return false;
  if (typeof bill.tax !== 'number') return false;
  if (typeof bill.total !== 'number') return false;
  
  // Sanity check: total should roughly match sum of items (within 50% for fees/discounts)
  const itemSum = bill.items.reduce((sum: number, item: { price: number; quantity?: number }) => {
    return sum + (item.price * (item.quantity || 1));
  }, 0);
  
  if (bill.total > 0 && itemSum > 0) {
    const ratio = bill.total / itemSum;
    if (ratio < 0.5 || ratio > 2) {
      console.warn('Total/items ratio seems off:', { total: bill.total, itemSum, ratio });
      // Don't fail validation, just warn - there might be discounts, fees, etc.
    }
  }
  
  return true;
}

/**
 * Parse JSON from LLM response, handling common issues
 */
function parseJsonResponse(text: string): unknown {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  
  return JSON.parse(cleaned);
}

// Timeout for Ollama calls (60s to stay under Cloudflare's 100s limit)
const OLLAMA_TIMEOUT_MS = 60000;

/**
 * Call Ollama API with timeout
 */
async function callOllama(markdown: string): Promise<BillData | null> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3:8b';
  
  // Truncate markdown if too long (Ollama struggles with very long prompts)
  const maxMarkdownLength = 8000;
  const truncatedMarkdown = markdown.length > maxMarkdownLength 
    ? markdown.slice(0, maxMarkdownLength) + '\n\n[Content truncated...]'
    : markdown;
  
  const prompt = EXTRACTION_PROMPT.replace('{MARKDOWN}', truncatedMarkdown);
  const startTime = Date.now();
  
  console.log('[LLM] Calling Ollama:', { baseUrl, model, promptLength: prompt.length, truncated: markdown.length > maxMarkdownLength });
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: 0,  // Deterministic output
          num_predict: 2048, // Reduced for faster response
        }
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log('[LLM] Ollama responded:', { status: response.status, durationMs: Date.now() - startTime });
    
    if (!response.ok) {
      console.error('Ollama request failed:', response.status, await response.text());
      return null;
    }
    
    const result = await response.json();
    const parsed = parseJsonResponse(result.response);
    
    if (validateBillData(parsed)) {
      // Normalize the data
      return {
        items: parsed.items.map(item => ({
          name: item.name.trim(),
          price: Math.round(item.price * 100) / 100,
          quantity: item.quantity || 1,
        })),
        subtotal: Math.round(parsed.subtotal * 100) / 100,
        tax: Math.round(parsed.tax * 100) / 100,
        total: Math.round(parsed.total * 100) / 100,
      };
    }
    
    console.warn('Ollama response failed validation');
    return null;
    
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[LLM] Ollama TIMEOUT after', OLLAMA_TIMEOUT_MS, 'ms');
    } else {
      console.error('[LLM] Ollama ERROR:', error instanceof Error ? error.message : error, 'after', Date.now() - startTime, 'ms');
    }
    return null;
  }
}

/**
 * Call Perplexity API (fallback)
 */
async function callPerplexity(markdown: string): Promise<BillData | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    console.error('PERPLEXITY_API_KEY not set');
    return null;
  }
  
  const prompt = EXTRACTION_PROMPT.replace('{MARKDOWN}', markdown);
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',  // or 'sonar-pro' for better results
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts structured data from bills and invoices. Always respond with valid JSON only, no markdown formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0,
        max_tokens: 4096,
      }),
    });
    
    if (!response.ok) {
      console.error('Perplexity request failed:', response.status, await response.text());
      return null;
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in Perplexity response');
      return null;
    }
    
    const parsed = parseJsonResponse(content);
    
    if (validateBillData(parsed)) {
      return {
        items: parsed.items.map(item => ({
          name: item.name.trim(),
          price: Math.round(item.price * 100) / 100,
          quantity: item.quantity || 1,
        })),
        subtotal: Math.round(parsed.subtotal * 100) / 100,
        tax: Math.round(parsed.tax * 100) / 100,
        total: Math.round(parsed.total * 100) / 100,
      };
    }
    
    console.warn('Perplexity response failed validation');
    return null;
    
  } catch (error) {
    console.error('Perplexity error:', error);
    return null;
  }
}

/**
 * Extract bill data from markdown using hybrid LLM approach
 * 
 * Tries Ollama first (free), falls back to Perplexity (paid) if validation fails
 */
export async function extractBillData(markdown: string): Promise<BillData> {
  // Try Ollama first (free)
  console.log('Attempting extraction with Ollama...');
  const ollamaResult = await callOllama(markdown);
  
  if (ollamaResult) {
    console.log('Ollama extraction successful');
    return ollamaResult;
  }
  
  // Fallback to Perplexity
  console.log('Ollama failed, trying Perplexity...');
  const perplexityResult = await callPerplexity(markdown);
  
  if (perplexityResult) {
    console.log('Perplexity extraction successful');
    return perplexityResult;
  }
  
  // Both failed - return empty structure
  console.error('Both LLMs failed to extract bill data');
  throw new Error('Failed to extract bill data. Please try again or enter items manually.');
}

/**
 * Simple extraction without LLM (for testing/fallback)
 * Tries to parse basic line-item patterns from receipts
 */
export function extractBillDataSimple(markdown: string): BillData {
  const items: BillItem[] = [];
  const lines = markdown.split('\n');
  
  // Skip words that are likely not items
  const skipPatterns = /^(subtotal|total|tax|shipping|delivery|tip|fee|discount|savings|order|payment|card|visa|mastercard|amex|debit|credit|change|balance|thank|receipt|store|date|time|sold|qty|price|description|item\s*#|sku)/i;
  
  // Patterns for extracting items with prices
  const patterns = [
    // Pattern 1: "Item Name $12.34" or "Item Name 12.34"
    /^(.+?)\s+\$?\s*(\d+\.\d{2})\s*$/,
    // Pattern 2: "$12.34 Item Name" (price first)
    /^\$?\s*(\d+\.\d{2})\s+(.+)$/,
    // Pattern 3: Table format with | separator: "| Item | $12.34 |"
    /\|\s*(.+?)\s*\|\s*\$?\s*(\d+\.\d{2})\s*\|/,
    // Pattern 4: "2x Item Name $12.34" (quantity prefix)
    /^(\d+)\s*x\s+(.+?)\s+\$?\s*(\d+\.\d{2})\s*$/,
  ];
  
  let tax = 0;
  let total = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;
    
    // Skip header/footer lines
    if (skipPatterns.test(trimmed)) {
      // But try to extract tax and total
      const taxMatch = trimmed.match(/tax[:\s]+\$?\s*(\d+\.\d{2})/i);
      if (taxMatch) tax = parseFloat(taxMatch[1]);
      
      const totalMatch = trimmed.match(/total[:\s]+\$?\s*(\d+\.\d{2})/i);
      if (totalMatch) total = parseFloat(totalMatch[1]);
      
      continue;
    }
    
    // Try each pattern
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        let name: string;
        let price: number;
        let quantity = 1;
        
        if (pattern === patterns[3]) {
          // Quantity pattern
          quantity = parseInt(match[1]);
          name = match[2].trim();
          price = parseFloat(match[3]);
        } else if (pattern === patterns[1]) {
          // Price first pattern
          price = parseFloat(match[1]);
          name = match[2].trim();
        } else {
          // Standard patterns
          name = match[1].trim();
          price = parseFloat(match[2]);
        }
        
        // Validate
        if (name && name.length > 1 && !isNaN(price) && price > 0 && price < 10000) {
          // Clean up name
          name = name.replace(/^\||\|$/g, '').trim();
          if (name.length > 2 && !skipPatterns.test(name)) {
            items.push({ name, price, quantity });
          }
        }
        break;
      }
    }
  }
  
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const finalTotal = total > 0 ? total : subtotal + tax;
  
  console.log('[LLM] Simple extraction found', items.length, 'items, subtotal:', subtotal, 'tax:', tax, 'total:', finalTotal);
  
  return {
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(finalTotal * 100) / 100,
  };
}

