import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaDbPath: string | undefined;
};

function createPrismaClient() {
  // Get the absolute path to the database file (in project root)
  const dbPath = path.join(process.cwd(), "dev.db");
  
  console.log("[Prisma] Creating client with db path:", dbPath);
  
  // Prisma 7 adapter takes a config object with url
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  
  // Store the path for cache invalidation
  globalForPrisma.prismaDbPath = dbPath;
  
  return new PrismaClient({ adapter });
}

// Invalidate cache if db path changed
const currentDbPath = path.join(process.cwd(), "dev.db");
if (globalForPrisma.prismaDbPath !== currentDbPath) {
  globalForPrisma.prisma = undefined;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

