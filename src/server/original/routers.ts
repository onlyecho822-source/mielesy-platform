import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { addToWaitlist, getWaitlistEntries, getWaitlistStats, getWaitlistCount } from "./db";
import { notifyOwner } from "./_core/notification";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════
// RATE LIMITING — in-memory store for anti-spam
// ═══════════════════════════════════════════════════════════
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // max 3 signups per IP per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitStore.entries()).forEach(([key, val]) => {
    if (now > val.resetAt) rateLimitStore.delete(key);
  });
}, 5 * 60 * 1000);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ═══════════════════════════════════════════════════════════
  // WAITLIST — public signup + admin management
  // ═══════════════════════════════════════════════════════════
  waitlist: router({
    // Public: join the waitlist
    join: publicProcedure
      .input(
        z.object({
          email: z.string().email("Please enter a valid email address"),
          name: z.string().optional(),
          tier: z.enum(["free", "premium", "vip"]).default("free"),
          utmSource: z.string().optional(),
          utmMedium: z.string().optional(),
          utmCampaign: z.string().optional(),
          referrer: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Rate limit check
        const clientIp =
          (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          ctx.req.socket?.remoteAddress ||
          "unknown";

        if (!checkRateLimit(clientIp)) {
          return {
            success: false,
            message: "Demasiadas solicitudes. Intenta de nuevo en un minuto. / Too many requests. Try again in a minute.",
          };
        }

        const result = await addToWaitlist({
          email: input.email.toLowerCase().trim(),
          name: input.name || null,
          tier: input.tier,
          utmSource: input.utmSource || null,
          utmMedium: input.utmMedium || null,
          utmCampaign: input.utmCampaign || null,
          referrer: input.referrer || null,
        });

        if (!result.success) {
          return {
            success: false,
            message: "Ya estás registrada. Te contactaremos pronto. / You're already registered. We'll contact you soon.",
          };
        }

        // Notify owner of new signup
        const tierLabel = input.tier === "vip" ? "VIP ($29.99)" : input.tier === "premium" ? "Premium ($9.99)" : "Free";
        const source = input.utmSource ? ` | Source: ${input.utmSource}` : "";
        await notifyOwner({
          title: `🆕 New Waitlist Signup: ${input.email}`,
          content: `Email: ${input.email}\nTier: ${tierLabel}${source}\nName: ${input.name || "Not provided"}\nTime: ${new Date().toISOString()}`,
        }).catch(err => console.warn("[Waitlist] Failed to notify owner:", err));

        return {
          success: true,
          message: "¡Bienvenida! Te contactaremos pronto. / Welcome! We'll contact you soon.",
        };
      }),

    // Public: get total count (for social proof on landing page)
    count: publicProcedure.query(async () => {
      return { count: await getWaitlistCount() };
    }),

    // Admin: list all entries
    list: adminProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
          tier: z.enum(["free", "premium", "vip"]).optional(),
        })
      )
      .query(async ({ input }) => {
        const entries = await getWaitlistEntries(input);
        return { entries };
      }),

    // Admin: get analytics/stats
    stats: adminProcedure.query(async () => {
      return getWaitlistStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
