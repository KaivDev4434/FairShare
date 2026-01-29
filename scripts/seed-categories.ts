import { db } from '../src/lib/db';

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
      { name: 'Movies & Shows', slug: 'entertainment-movies', icon: '🎥' },
      { name: 'Concerts & Events', slug: 'entertainment-events', icon: '🎤' },
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
      { name: 'Online Shopping', slug: 'shopping-online', icon: '🖥️' },
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
      { name: 'Internet', slug: 'utilities-internet', icon: '🌐' },
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
      { name: 'Doctor & Medical', slug: 'healthcare-medical', icon: '👨‍⚕️' },
      { name: 'Pharmacy', slug: 'healthcare-pharmacy', icon: '💊' },
      { name: 'Gym & Fitness', slug: 'healthcare-fitness', icon: '🏋️' },
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
      { name: 'Vacation Activities', slug: 'travel-activities', icon: '🎢' },
      { name: 'Travel Food', slug: 'travel-food', icon: '🍱' },
    ],
  },
  {
    name: 'Education',
    slug: 'education',
    icon: '📚',
    color: 'indigo',
    children: [
      { name: 'Courses', slug: 'education-courses', icon: '🎓' },
      { name: 'Books & Supplies', slug: 'education-books', icon: '📖' },
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

async function seedCategories() {
  console.log('🌱 Seeding categories...');

  for (const category of categories) {
    // Check if parent category already exists
    const existing = await db.category.findUnique({
      where: { slug: category.slug },
    });

    if (existing) {
      console.log(`  ⏭️  Skipping ${category.name} (already exists)`);
      continue;
    }

    // Create parent category
    const parent = await db.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        color: category.color,
        userId: null, // Global category
      },
    });
    console.log(`  ✅ Created ${category.name}`);

    // Create children
    for (const child of category.children) {
      const existingChild = await db.category.findUnique({
        where: { slug: child.slug },
      });

      if (existingChild) {
        console.log(`    ⏭️  Skipping ${child.name} (already exists)`);
        continue;
      }

      await db.category.create({
        data: {
          name: child.name,
          slug: child.slug,
          icon: child.icon,
          color: category.color, // Inherit parent color
          parentId: parent.id,
          userId: null, // Global category
        },
      });
      console.log(`    ✅ Created ${child.name}`);
    }
  }

  console.log('✨ Category seeding complete!');
}

// Run the seed
seedCategories()
  .catch((e) => {
    console.error('❌ Error seeding categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
