import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'fairshare.db');
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

// Predefined category hierarchy with colors for visual distinction
const categories = [
  {
    name: 'Food & Dining',
    slug: 'food',
    icon: '🍽️',
    color: 'orange',
    children: [
      { name: 'Restaurants', slug: 'food-restaurants', icon: '🍴' },
      { name: 'Groceries', slug: 'food-groceries', icon: '🛒' },
      { name: 'Coffee & Cafes', slug: 'food-coffee', icon: '☕' },
      { name: 'Fast Food', slug: 'food-fastfood', icon: '🍔' },
      { name: 'Bars & Alcohol', slug: 'food-bars', icon: '🍺' },
      { name: 'Delivery', slug: 'food-delivery', icon: '📦' },
    ],
  },
  {
    name: 'Transportation',
    slug: 'transportation',
    icon: '🚗',
    color: 'blue',
    children: [
      { name: 'Rideshare', slug: 'transportation-rideshare', icon: '🚕' },
      { name: 'Gas & Fuel', slug: 'transportation-gas', icon: '⛽' },
      { name: 'Parking', slug: 'transportation-parking', icon: '🅿️' },
      { name: 'Public Transit', slug: 'transportation-transit', icon: '🚇' },
      { name: 'Car Rental', slug: 'transportation-rental', icon: '🚙' },
    ],
  },
  {
    name: 'Entertainment',
    slug: 'entertainment',
    icon: '🎬',
    color: 'purple',
    children: [
      { name: 'Movies', slug: 'entertainment-movies', icon: '🎥' },
      { name: 'Events & Concerts', slug: 'entertainment-events', icon: '🎤' },
      { name: 'Gaming', slug: 'entertainment-gaming', icon: '🎮' },
      { name: 'Sports', slug: 'entertainment-sports', icon: '⚽' },
      { name: 'Streaming', slug: 'entertainment-streaming', icon: '📺' },
    ],
  },
  {
    name: 'Shopping',
    slug: 'shopping',
    icon: '🛍️',
    color: 'pink',
    children: [
      { name: 'Clothing', slug: 'shopping-clothing', icon: '👕' },
      { name: 'Electronics', slug: 'shopping-electronics', icon: '📱' },
      { name: 'Home & Garden', slug: 'shopping-home', icon: '🏠' },
      { name: 'Gifts', slug: 'shopping-gifts', icon: '🎁' },
      { name: 'Online Shopping', slug: 'shopping-online', icon: '🛒' },
    ],
  },
  {
    name: 'Utilities',
    slug: 'utilities',
    icon: '💡',
    color: 'yellow',
    children: [
      { name: 'Electric', slug: 'utilities-electric', icon: '⚡' },
      { name: 'Water', slug: 'utilities-water', icon: '💧' },
      { name: 'Internet', slug: 'utilities-internet', icon: '📶' },
      { name: 'Phone', slug: 'utilities-phone', icon: '📞' },
      { name: 'Subscriptions', slug: 'utilities-subscriptions', icon: '📋' },
    ],
  },
  {
    name: 'Healthcare',
    slug: 'healthcare',
    icon: '🏥',
    color: 'red',
    children: [
      { name: 'Medical', slug: 'healthcare-medical', icon: '👨‍⚕️' },
      { name: 'Pharmacy', slug: 'healthcare-pharmacy', icon: '💊' },
      { name: 'Fitness', slug: 'healthcare-fitness', icon: '🏋️' },
      { name: 'Wellness', slug: 'healthcare-wellness', icon: '🧘' },
    ],
  },
  {
    name: 'Travel',
    slug: 'travel',
    icon: '✈️',
    color: 'cyan',
    children: [
      { name: 'Flights', slug: 'travel-flights', icon: '🛫' },
      { name: 'Hotels', slug: 'travel-hotels', icon: '🏨' },
      { name: 'Activities', slug: 'travel-activities', icon: '🎢' },
      { name: 'Travel Food', slug: 'travel-food', icon: '🍕' },
    ],
  },
  {
    name: 'Education',
    slug: 'education',
    icon: '📚',
    color: 'indigo',
    children: [
      { name: 'Courses', slug: 'education-courses', icon: '🎓' },
      { name: 'Books', slug: 'education-books', icon: '📖' },
      { name: 'Tuition', slug: 'education-tuition', icon: '🏫' },
    ],
  },
  {
    name: 'Other',
    slug: 'other',
    icon: '📦',
    color: 'gray',
    children: [],
  },
];

async function main() {
  console.log('🌱 Seeding categories...');
  
  // Clear existing categories
  await prisma.category.deleteMany({});
  console.log('  Cleared existing categories');
  
  let parentCount = 0;
  let childCount = 0;
  
  for (const category of categories) {
    // Create parent category
    const parent = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        color: category.color,
        userId: null, // Global category
      },
    });
    parentCount++;
    console.log(`  Created parent: ${category.name} (${category.slug})`);
    
    // Create child categories
    if (category.children && category.children.length > 0) {
      for (const child of category.children) {
        await prisma.category.create({
          data: {
            name: child.name,
            slug: child.slug,
            icon: child.icon,
            color: category.color, // Inherit parent color
            parentId: parent.id,
            userId: null, // Global category
          },
        });
        childCount++;
      }
      console.log(`    Created ${category.children.length} children for ${category.name}`);
    }
  }
  
  console.log(`\n✅ Seeding complete! Created ${parentCount} parent categories and ${childCount} subcategories.`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
