#!/usr/bin/env node
/**
 * Initialize the SQLite database with required tables
 * This script is run when the container starts
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "fairshare.db");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log("Created data directory:", dataDir);
}

console.log("Initializing database at:", dbPath);

const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
CREATE TABLE IF NOT EXISTS Bill (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    locked INTEGER NOT NULL DEFAULT 0,
    taxAmount REAL NOT NULL DEFAULT 0,
    tipAmount REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Item (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    billId TEXT NOT NULL,
    FOREIGN KEY (billId) REFERENCES Bill (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Share (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    billId TEXT NOT NULL,
    FOREIGN KEY (billId) REFERENCES Bill (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Claim (
    id TEXT NOT NULL PRIMARY KEY,
    shareId TEXT NOT NULL,
    itemId TEXT NOT NULL,
    portion REAL NOT NULL DEFAULT 1,
    FOREIGN KEY (shareId) REFERENCES Share (id) ON DELETE CASCADE,
    FOREIGN KEY (itemId) REFERENCES Item (id) ON DELETE CASCADE
);
`);

// Create unique index if it doesn't exist
try {
  db.exec(`CREATE UNIQUE INDEX Claim_shareId_itemId_key ON Claim(shareId, itemId)`);
  console.log("Created unique index");
} catch (e) {
  // Index already exists
}

console.log("Database initialized successfully!");
db.close();

