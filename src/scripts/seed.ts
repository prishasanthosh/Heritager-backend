/**
 * Seeds a few demo categories and products so the shop/admin apps have
 * something to show immediately. Run with: npm run seed
 */
import "dotenv/config";
import { connectDB } from "../config/db.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { Project } from "../models/Project.js";
import mongoose from "mongoose";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function seed() {
  await connectDB();

  const categoryNames = ["Handicrafts", "Textiles", "Books & Art", "Home Decor"];
  const categories = [];
  for (const name of categoryNames) {
    const category = await Category.findOneAndUpdate(
      { slug: slugify(name) },
      { name, slug: slugify(name) },
      { upsert: true, new: true }
    );
    categories.push(category);
  }

  const demoProducts = [
    { name: "Handwoven Cotton Saree", price: 1899, stock: 25, category: categories[1] },
    { name: "Terracotta Wall Art", price: 749, stock: 40, category: categories[0] },
    { name: "Illustrated Heritage Storybook", price: 349, stock: 100, category: categories[2] },
    { name: "Brass Diya Set (Pack of 4)", price: 599, stock: 60, category: categories[3] },
    { name: "Block-Printed Cushion Cover", price: 449, stock: 80, category: categories[3] },
    { name: "Handmade Jute Tote Bag", price: 299, stock: 120, category: categories[0] },
  ];

  for (const p of demoProducts) {
    const slug = slugify(p.name) + "-" + Math.random().toString(36).slice(2, 7);
    await Product.findOneAndUpdate(
      { name: p.name },
      {
        name: p.name,
        slug,
        price: p.price,
        stock: p.stock,
        category: p.category._id,
        description: `${p.name} — handcrafted by artisan communities supported by Indian Heritager Foundation.`,
        images: [],
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const projectNames = [
    "General Donation for Organization",
    "Education",
    "Project Vidhyadhanam",
    "Environment & Sustainability",
    "Women Empowerment",
    "Livelihood Programs",
    "Digital Literacy",
    "Community Development",
    "Health Initiatives",
    "Emergency Relief",
  ];
  for (const [i, name] of projectNames.entries()) {
    await Project.findOneAndUpdate(
      { slug: slugify(name) },
      { name, slug: slugify(name), sortOrder: i, isActive: true },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`Seeded ${categories.length} categories, ${demoProducts.length} products and ${projectNames.length} donation projects.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
