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
-- NextAuth.js tables
CREATE TABLE IF NOT EXISTS User (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    emailVerified TEXT,
    image TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Account (
    id TEXT NOT NULL PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    FOREIGN KEY (userId) REFERENCES User (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Session (
    id TEXT NOT NULL PRIMARY KEY,
    sessionToken TEXT NOT NULL UNIQUE,
    userId TEXT NOT NULL,
    expires TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES User (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS VerificationToken (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires TEXT NOT NULL
);

-- FairShare tables
CREATE TABLE IF NOT EXISTS Bill (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked INTEGER NOT NULL DEFAULT 0,
    taxAmount REAL NOT NULL DEFAULT 0,
    tipAmount REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    userId TEXT,
    FOREIGN KEY (userId) REFERENCES User (id) ON DELETE SET NULL
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

// Create indexes if they don't exist
const indexes = [
  { name: "Claim_shareId_itemId_key", sql: "CREATE UNIQUE INDEX Claim_shareId_itemId_key ON Claim(shareId, itemId)" },
  { name: "Account_provider_providerAccountId_key", sql: "CREATE UNIQUE INDEX Account_provider_providerAccountId_key ON Account(provider, providerAccountId)" },
  { name: "VerificationToken_identifier_token_key", sql: "CREATE UNIQUE INDEX VerificationToken_identifier_token_key ON VerificationToken(identifier, token)" },
];

for (const idx of indexes) {
  try {
    db.exec(idx.sql);
    console.log(`Created index: ${idx.name}`);
  } catch (e) {
    // Index already exists
  }
}

// Add userId column to Bill if it doesn't exist (migration for existing data)
try {
  db.exec("ALTER TABLE Bill ADD COLUMN userId TEXT REFERENCES User(id) ON DELETE SET NULL");
  console.log("Added userId column to Bill table");
} catch (e) {
  // Column already exists
}

console.log("Database initialized successfully!");
db.close();
