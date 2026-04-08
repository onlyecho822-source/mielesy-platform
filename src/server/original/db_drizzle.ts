import { eq, desc, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, waitlist, InsertWaitlistEntry } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ═══════════════════════════════════════════════════════════
// WAITLIST QUERIES
// ═══════════════════════════════════════════════════════════

export async function addToWaitlist(entry: InsertWaitlistEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check for duplicate email
  const existing = await db
    .select()
    .from(waitlist)
    .where(eq(waitlist.email, entry.email))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, reason: "already_registered" as const };
  }

  await db.insert(waitlist).values(entry);
  return { success: true, reason: null };
}

export async function getWaitlistEntries(opts: {
  limit?: number;
  offset?: number;
  tier?: "free" | "premium" | "vip";
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(waitlist).orderBy(desc(waitlist.createdAt));

  if (opts.tier) {
    query = query.where(eq(waitlist.tier, opts.tier)) as typeof query;
  }

  return query.limit(opts.limit ?? 50).offset(opts.offset ?? 0);
}

export async function getWaitlistStats() {
  const db = await getDb();
  if (!db) return { total: 0, free: 0, premium: 0, vip: 0, today: 0, thisWeek: 0, thisMonth: 0, bySource: [] as { source: string; count: number }[] };

  const [totalResult] = await db.select({ count: count() }).from(waitlist);
  const [freeResult] = await db.select({ count: count() }).from(waitlist).where(eq(waitlist.tier, "free"));
  const [premiumResult] = await db.select({ count: count() }).from(waitlist).where(eq(waitlist.tier, "premium"));
  const [vipResult] = await db.select({ count: count() }).from(waitlist).where(eq(waitlist.tier, "vip"));

  // Today's signups
  const [todayResult] = await db.select({ count: count() }).from(waitlist)
    .where(sql`DATE(${waitlist.createdAt}) = CURDATE()`);

  // This week's signups
  const [weekResult] = await db.select({ count: count() }).from(waitlist)
    .where(sql`${waitlist.createdAt} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);

  // This month's signups
  const [monthResult] = await db.select({ count: count() }).from(waitlist)
    .where(sql`${waitlist.createdAt} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`);

  // By UTM source
  const bySource = await db
    .select({
      source: waitlist.utmSource,
      count: count(),
    })
    .from(waitlist)
    .groupBy(waitlist.utmSource)
    .orderBy(desc(count()));

  return {
    total: totalResult?.count ?? 0,
    free: freeResult?.count ?? 0,
    premium: premiumResult?.count ?? 0,
    vip: vipResult?.count ?? 0,
    today: todayResult?.count ?? 0,
    thisWeek: weekResult?.count ?? 0,
    thisMonth: monthResult?.count ?? 0,
    bySource: bySource.map(s => ({ source: s.source ?? "direct", count: s.count })),
  };
}

export async function getWaitlistCount() {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: count() }).from(waitlist);
  return result?.count ?? 0;
}
