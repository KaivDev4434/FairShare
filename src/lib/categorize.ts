import { db } from '@/lib/db';

export interface ItemToCategorize {
  name: string;
  price: number;
}

export interface CategorySuggestion {
  itemName: string;
  categorySlug: string | null;
  categoryId: string | null;
  categoryName: string;
  parentName: string | null;
  confidence: number;
  method: 'keyword' | 'ollama' | 'perplexity' | 'none';
  suggestedNew: { name: string; parentSlug: string } | null;
}

// Minimum confidence threshold to accept keyword match without LLM
const KEYWORD_CONFIDENCE_THRESHOLD = 0.6;

// Timeout for Ollama calls (30s for categorization - faster than bill parsing)
const OLLAMA_TIMEOUT_MS = 30000;

// Category keywords mapping for rule-based categorization (fallback)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Food & Dining
  'food-restaurants': ['restaurant', 'diner', 'cafe', 'bistro', 'grill', 'steakhouse', 'sushi', 'pizza', 'burger', 'taco', 'chinese', 'mexican', 'italian', 'thai', 'indian', 'japanese', 'korean', 'vietnamese', 'dinner', 'lunch', 'brunch', 'breakfast'],
  'food-groceries': ['grocery', 'supermarket', 'market', 'produce', 'meat', 'vegetable', 'fruit', 'milk', 'eggs', 'bread', 'cheese', 'costco', 'walmart', 'target', 'kroger', 'safeway', 'whole foods', 'trader joe', 'tomato', 'potato', 'onion', 'garlic', 'lettuce', 'carrot', 'apple', 'banana', 'orange'],
  'food-coffee': ['coffee', 'starbucks', 'dunkin', 'espresso', 'latte', 'cappuccino', 'mocha', 'tea', 'boba', 'cafe'],
  'food-fastfood': ['mcdonald', 'burger king', 'wendy', 'taco bell', 'kfc', 'popeyes', 'chick-fil-a', 'subway', 'chipotle', 'five guys', 'in-n-out', 'shake shack'],
  'food-bars': ['bar', 'pub', 'brewery', 'beer', 'wine', 'cocktail', 'whiskey', 'vodka', 'liquor', 'alcohol', 'drinks'],
  'food-delivery': ['doordash', 'ubereats', 'uber eats', 'grubhub', 'postmates', 'seamless', 'instacart', 'delivery fee'],
  
  // Transportation
  'transportation-rideshare': ['uber', 'lyft', 'ride', 'taxi', 'cab', 'rideshare'],
  'transportation-gas': ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'mobil', 'bp', 'arco', 'texaco', 'gasoline', 'diesel', 'petrol', 'oil'],
  'transportation-parking': ['parking', 'meter', 'garage', 'valet', 'parkwhiz', 'spothero'],
  'transportation-transit': ['metro', 'subway', 'bus', 'train', 'transit', 'bart', 'mta', 'cta', 'muni', 'septa'],
  'transportation-rental': ['rental', 'hertz', 'enterprise', 'avis', 'budget', 'national', 'turo', 'zipcar'],
  
  // Entertainment
  'entertainment-movies': ['movie', 'cinema', 'theater', 'theatre', 'amc', 'regal', 'cinemark', 'imax', 'film', 'screening'],
  'entertainment-events': ['concert', 'ticket', 'show', 'event', 'festival', 'ticketmaster', 'stubhub', 'eventbrite', 'live nation'],
  'entertainment-gaming': ['game', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam', 'epic games', 'arcade'],
  'entertainment-sports': ['sports', 'gym', 'fitness', 'workout', 'yoga', 'basketball', 'football', 'baseball', 'soccer', 'tennis', 'golf'],
  'entertainment-streaming': ['netflix', 'hulu', 'disney+', 'disney plus', 'hbo', 'amazon prime', 'spotify', 'apple music', 'youtube premium', 'streaming'],
  
  // Shopping
  'shopping-clothing': ['clothing', 'clothes', 'shirt', 'pants', 'dress', 'shoes', 'nike', 'adidas', 'zara', 'h&m', 'gap', 'nordstrom', 'macy', 'fashion'],
  'shopping-electronics': ['electronics', 'phone', 'laptop', 'computer', 'tablet', 'headphones', 'apple', 'samsung', 'best buy', 'tech'],
  'shopping-home': ['home', 'furniture', 'ikea', 'wayfair', 'bed bath', 'crate barrel', 'pottery barn', 'home depot', 'lowes', 'garden', 'bed', 'mattress', 'pillow', 'blanket', 'sheet'],
  'shopping-gifts': ['gift', 'present', 'birthday', 'christmas', 'holiday', 'card', 'wrapping'],
  'shopping-online': ['amazon', 'ebay', 'etsy', 'online', 'shopify', 'checkout'],
  
  // Utilities
  'utilities-electric': ['electric', 'electricity', 'power', 'pge', 'con edison', 'duke energy', 'energy'],
  'utilities-water': ['water', 'sewer', 'utility'],
  'utilities-internet': ['internet', 'wifi', 'comcast', 'xfinity', 'spectrum', 'att', 'verizon fios', 'broadband'],
  'utilities-phone': ['phone', 'mobile', 'cell', 'verizon', 't-mobile', 'sprint', 'at&t wireless'],
  'utilities-subscriptions': ['subscription', 'membership', 'monthly', 'annual', 'premium', 'pro plan', 'hulu'],
  
  // Healthcare
  'healthcare-medical': ['doctor', 'medical', 'hospital', 'clinic', 'healthcare', 'health', 'appointment', 'checkup', 'urgent care'],
  'healthcare-pharmacy': ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'prescription', 'medicine', 'drug'],
  'healthcare-fitness': ['gym', 'fitness', 'workout', 'equinox', 'planet fitness', 'orangetheory', 'crossfit', 'peloton'],
  'healthcare-wellness': ['spa', 'massage', 'wellness', 'meditation', 'therapy', 'counseling'],
  
  // Travel
  'travel-flights': ['flight', 'airline', 'airfare', 'delta', 'united', 'american airlines', 'southwest', 'jetblue', 'airport'],
  'travel-hotels': ['hotel', 'motel', 'airbnb', 'vrbo', 'marriott', 'hilton', 'hyatt', 'inn', 'lodge', 'resort', 'accommodation'],
  'travel-activities': ['tour', 'excursion', 'sightseeing', 'museum', 'attraction', 'activity', 'adventure'],
  'travel-food': ['travel food', 'airport food', 'road trip food'],
  
  // Education
  'education-courses': ['course', 'class', 'udemy', 'coursera', 'skillshare', 'masterclass', 'workshop', 'training', 'tutorial'],
  'education-books': ['book', 'textbook', 'amazon books', 'barnes noble', 'kindle', 'audible', 'ebook'],
  'education-tuition': ['tuition', 'university', 'college', 'school', 'education', 'academic'],
};

type CategoryInfo = { 
  id: string; 
  slug: string; 
  name: string; 
  parentId: string | null; 
  parent: { name: string; slug: string } | null 
};

// Categorize a single item using keyword matching (fast, primary method)
function categorizeItemKeyword(itemName: string, categories: CategoryInfo[]): CategorySuggestion {
  const nameLower = itemName.toLowerCase();
  
  let bestMatch: { slug: string; confidence: number } | null = null;
  
  // Check each category's keywords
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword.toLowerCase())) {
        const confidence = keyword.length / Math.max(nameLower.length, 1);
        const adjustedConfidence = Math.min(0.95, 0.5 + confidence * 0.5);
        
        if (!bestMatch || adjustedConfidence > bestMatch.confidence) {
          bestMatch = { slug, confidence: adjustedConfidence };
        }
      }
    }
  }
  
  if (bestMatch) {
    const category = categories.find(c => c.slug === bestMatch!.slug);
    if (category) {
      return {
        itemName,
        categorySlug: category.slug,
        categoryId: category.id,
        categoryName: category.name,
        parentName: category.parent?.name || null,
        confidence: bestMatch.confidence,
        method: 'keyword',
        suggestedNew: null,
      };
    }
  }
  
  // No confident match - return low confidence result
  const otherCategory = categories.find(c => c.slug === 'other');
  return {
    itemName,
    categorySlug: otherCategory?.slug || 'other',
    categoryId: otherCategory?.id || null,
    categoryName: 'Other',
    parentName: null,
    confidence: 0.1, // Very low - signals need for LLM
    method: 'none',
    suggestedNew: null,
  };
}

// Build the LLM prompt for categorization
function buildCategorizationPrompt(items: ItemToCategorize[], categorySlugs: string[]): string {
  const itemsList = items.map((item, i) => `${i + 1}. "${item.name}" ($${item.price})`).join('\n');
  
  return `Categorize these items into the most appropriate category. Return ONLY valid JSON.

Items:
${itemsList}

Available category slugs:
${categorySlugs.join(', ')}

Return JSON array with one object per item:
[
  { "itemName": "string", "slug": "category-slug", "confidence": 0.0-1.0 }
]

Rules:
- "slug" must be one of the available slugs, or null if none fit
- "confidence" should reflect how certain you are (0.3 = uncertain, 0.9 = very sure)
- Match items to the most specific subcategory when possible

Return ONLY the JSON array, no explanation.`;
}

/**
 * Parse JSON from LLM response, handling common issues
 */
function parseJsonResponse(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}

/**
 * Convert parsed LLM response to CategorySuggestion format
 */
function parseLLMResponse(
  parsed: Array<{ itemName: string; slug: string | null; confidence: number }>,
  items: ItemToCategorize[],
  categories: CategoryInfo[],
  method: 'ollama' | 'perplexity'
): CategorySuggestion[] {
  return parsed.map((result, index) => {
    const originalItem = items[index];
    const category = result.slug ? categories.find(c => c.slug === result.slug) : null;
    
    if (category) {
      return {
        itemName: originalItem.name,
        categorySlug: category.slug,
        categoryId: category.id,
        categoryName: category.name,
        parentName: category.parent?.name || null,
        confidence: result.confidence,
        method,
        suggestedNew: null,
      };
    }
    
    // Fall back to "Other"
    const otherCategory = categories.find(c => c.slug === 'other');
    return {
      itemName: originalItem.name,
      categorySlug: otherCategory?.slug || 'other',
      categoryId: otherCategory?.id || null,
      categoryName: 'Other',
      parentName: null,
      confidence: 0.3,
      method,
      suggestedNew: null,
    };
  });
}

/**
 * Call Ollama API for LLM categorization (free, local)
 */
async function callOllamaForCategorization(
  items: ItemToCategorize[], 
  categories: CategoryInfo[]
): Promise<CategorySuggestion[] | null> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2:1.5b';
  
  const categorySlugs = categories.map(c => c.slug);
  const prompt = buildCategorizationPrompt(items, categorySlugs);
  
  console.log('[Categorize] Calling Ollama:', { baseUrl, model, items: items.length });
  const startTime = Date.now();
  
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
          temperature: 0,
          num_predict: 1024,
        }
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log('[Categorize] Ollama responded:', response.status, 'in', Date.now() - startTime, 'ms');
    
    if (!response.ok) {
      console.error('[Categorize] Ollama request failed:', response.status, await response.text());
      return null;
    }
    
    const result = await response.json();
    const parsed = parseJsonResponse(result.response) as Array<{ itemName: string; slug: string | null; confidence: number }>;
    
    if (!Array.isArray(parsed) || parsed.length !== items.length) {
      console.warn('[Categorize] Ollama response length mismatch');
      return null;
    }
    
    console.log('[Categorize] Successfully categorized', items.length, 'items via Ollama');
    return parseLLMResponse(parsed, items, categories, 'ollama');
    
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Categorize] Ollama TIMEOUT after', OLLAMA_TIMEOUT_MS, 'ms');
    } else {
      console.error('[Categorize] Ollama error:', error instanceof Error ? error.message : error);
    }
    return null;
  }
}

/**
 * Call Perplexity API for LLM categorization (paid, fallback)
 */
async function callPerplexityForCategorization(
  items: ItemToCategorize[], 
  categories: CategoryInfo[]
): Promise<CategorySuggestion[] | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    console.log('[Categorize] PERPLEXITY_API_KEY not set');
    return null;
  }
  
  const categorySlugs = categories.map(c => c.slug);
  const prompt = buildCategorizationPrompt(items, categorySlugs);
  
  console.log('[Categorize] Calling Perplexity API for', items.length, 'items');
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at categorizing expenses. Always respond with valid JSON only, no markdown formatting or explanation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0,
        max_tokens: 2048,
      }),
    });
    
    console.log('[Categorize] Perplexity responded:', response.status, 'in', Date.now() - startTime, 'ms');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Categorize] Perplexity request failed:', response.status, errorText);
      return null;
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('[Categorize] No content in Perplexity response');
      return null;
    }
    
    const parsed = parseJsonResponse(content) as Array<{ itemName: string; slug: string | null; confidence: number }>;
    
    if (!Array.isArray(parsed)) {
      console.error('[Categorize] Failed to parse Perplexity response');
      return null;
    }
    
    console.log('[Categorize] Successfully categorized', items.length, 'items via Perplexity');
    return parseLLMResponse(parsed, items, categories, 'perplexity');
    
  } catch (error) {
    console.error('[Categorize] Perplexity error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Categorize items using a tiered approach:
 * 1. Keyword matching (instant, free) - for high-confidence matches
 * 2. Ollama/Qwen (local LLM) - for items keyword couldn't categorize confidently
 * 3. Perplexity (paid API) - fallback if Ollama fails
 */
export async function categorizeItems(
  items: ItemToCategorize[],
  userId?: string | null
): Promise<CategorySuggestion[]> {
  // Get all categories (global + user-specific)
  const categories = await db.category.findMany({
    where: {
      OR: [
        { userId: null },
        ...(userId ? [{ userId }] : []),
      ],
    },
    include: {
      parent: {
        select: { name: true, slug: true },
      },
    },
  });
  
  console.log('[Categorize] Found', categories.length, 'categories to match against');
  
  if (categories.length === 0) {
    console.warn('[Categorize] No categories found in database! Please run seed-categories script.');
    return items.map(item => ({
      itemName: item.name,
      categorySlug: null,
      categoryId: null,
      categoryName: 'Uncategorized',
      parentName: null,
      confidence: 0,
      method: 'none' as const,
      suggestedNew: null,
    }));
  }
  
  // STEP 1: Try keyword matching first (instant, free)
  console.log('[Categorize] Step 1: Keyword matching for', items.length, 'items');
  const keywordResults = items.map(item => ({
    item,
    suggestion: categorizeItemKeyword(item.name, categories),
  }));
  
  // Split items into confident matches and items needing LLM
  const confidentMatches: CategorySuggestion[] = [];
  const itemsNeedingLLM: { index: number; item: ItemToCategorize }[] = [];
  
  keywordResults.forEach((result, index) => {
    if (result.suggestion.confidence >= KEYWORD_CONFIDENCE_THRESHOLD) {
      confidentMatches.push(result.suggestion);
      console.log(`[Categorize] Keyword match: "${result.item.name}" → ${result.suggestion.categoryName} (${(result.suggestion.confidence * 100).toFixed(0)}%)`);
    } else {
      itemsNeedingLLM.push({ index, item: result.item });
    }
  });
  
  console.log(`[Categorize] Keyword: ${confidentMatches.length} confident, ${itemsNeedingLLM.length} need LLM`);
  
  // If all items were matched by keywords, we're done!
  if (itemsNeedingLLM.length === 0) {
    console.log('[Categorize] All items categorized via keyword matching');
    return confidentMatches;
  }
  
  // Build result array with keyword matches in correct positions
  const results: CategorySuggestion[] = new Array(items.length);
  let confidentIndex = 0;
  for (let i = 0; i < items.length; i++) {
    if (!itemsNeedingLLM.find(x => x.index === i)) {
      results[i] = confidentMatches[confidentIndex++];
    }
  }
  
  // STEP 2: Try Ollama for remaining items (free, local)
  console.log('[Categorize] Step 2: Ollama for', itemsNeedingLLM.length, 'items');
  const llmItems = itemsNeedingLLM.map(x => x.item);
  
  let llmSuggestions = await callOllamaForCategorization(llmItems, categories);
  
  // STEP 3: If Ollama failed, try Perplexity (paid fallback)
  if (!llmSuggestions) {
    console.log('[Categorize] Step 3: Perplexity fallback for', itemsNeedingLLM.length, 'items');
    llmSuggestions = await callPerplexityForCategorization(llmItems, categories);
  }
  
  // STEP 4: If LLM failed too, use low-confidence keyword matches
  if (!llmSuggestions) {
    console.log('[Categorize] LLM failed, using keyword matches with low confidence');
    llmSuggestions = llmItems.map(item => categorizeItemKeyword(item.name, categories));
  }
  
  // Merge LLM suggestions back into results
  itemsNeedingLLM.forEach((x, i) => {
    results[x.index] = llmSuggestions![i];
  });
  
  // Log summary
  const methodCounts = { keyword: 0, ollama: 0, perplexity: 0, none: 0 };
  results.forEach(r => methodCounts[r.method]++);
  console.log('[Categorize] Summary:', methodCounts);
  
  return results;
}
