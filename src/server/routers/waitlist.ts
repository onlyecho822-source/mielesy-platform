// src/server/routers/waitlist.ts
// PORTED from original archive routers.ts
// Full waitlist: join (public), count (public), list (admin), stats (admin)
// Rate limiting: 3 submissions / IP / minute (in-memory, swap for Upstash in prod)

import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "../trpc"
import { db } from "../db"
import { notify } from "../sonic/notify"

// ── In-memory rate limiter (replace with Upstash Redis in prod) ──────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000  // 1 minute
const RATE_LIMIT_MAX = 3

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  Array.from(rateLimitStore.entries()).forEach(([key, val]) => {
    if (now > val.resetAt) rateLimitStore.delete(key)
  })
}, 5 * 60 * 1000)

export const waitlistRouter = router({
  // Public: join the waitlist
  join: publicProcedure
    .input(z.object({
      email:       z.string().email(),
      name:        z.string().max(100).optional(),
      location:    z.string().max(100).optional(),
      tier:        z.enum(["EXPLORER", "MEMBER", "VIP"]).default("MEMBER"),
      message:     z.string().max(500).optional(),
      utmSource:   z.string().max(100).optional(),
      utmMedium:   z.string().max(100).optional(),
      utmCampaign: z.string().max(100).optional(),
      inviteCode:  z.string().max(50).optional(),
      ip:          z.string().optional(),  // passed from middleware
    }))
    .mutation(async ({ input }) => {
      // Rate limit
      const ip = input.ip ?? "unknown"
      if (!checkRateLimit(ip)) {
        return {
          success: false,
          message: "Demasiadas solicitudes. Intenta de nuevo en un minuto. / Too many requests. Try again in a minute.",
        }
      }

      // Duplicate check
      const existing = await db.waitlistEntry.findUnique({
        where: { email: input.email.toLowerCase().trim() }
      })
      if (existing) {
        return {
          success: false,
          message: "Ya estás registrada. Te contactaremos pronto. / You\'re already registered. We\'ll contact you soon.",
        }
      }

      // Create entry
      await db.waitlistEntry.create({
        data: {
          email:       input.email.toLowerCase().trim(),
          name:        input.name ?? null,
          location:    input.location ?? null,
          tier:        input.tier,
          message:     input.message ?? null,
          utmSource:   input.utmSource ?? null,
          utmMedium:   input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
          inviteCode:  input.inviteCode ?? null,
        }
      })

      // Owner notification via Resend (replaces Manus forgeApi)
      // await resend.emails.send({
      //   from: "Mielesy <hola@mielesy.com>",
      //   to: process.env.OWNER_EMAIL!,
      //   subject: `Nueva solicitud: ${input.email}`,
      //   text: `Email: ${input.email}\nTier: ${input.tier}\nNombre: ${input.name ?? "—"}\nFuente: ${input.utmSource ?? "direct"}`,
      // })

      return {
        success: true,
        message: "¡Bienvenida! Te contactaremos pronto. / Welcome! We\'ll contact you soon.",
      }
    }),

  // Public: count for social proof
  count: publicProcedure.query(async () => {
    const count = await db.waitlistEntry.count()
    return { count }
  }),

  // Admin: list all entries
  list: protectedProcedure
    .input(z.object({
      limit:  z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
      tier:   z.enum(["EXPLORER", "MEMBER", "VIP"]).optional(),
    }))
    .query(async ({ input }) => {
      const entries = await db.waitlistEntry.findMany({
        where: input.tier ? { tier: input.tier } : undefined,
        orderBy: { createdAt: "desc" },
        skip: input.offset,
        take: input.limit,
      })
      return { entries }
    }),

  // Admin: stats
  stats: protectedProcedure.query(async () => {
    const [total, byTier] = await Promise.all([
      db.waitlistEntry.count(),
      db.waitlistEntry.groupBy({
        by: ["tier"],
        _count: { tier: true },
      }),
    ])
    const tierMap = Object.fromEntries(byTier.map(b => [b.tier, b._count.tier]))
    return {
      total,
      explorer: tierMap["EXPLORER"] ?? 0,
      member:   tierMap["MEMBER"]   ?? 0,
      vip:      tierMap["VIP"]      ?? 0,
    }
  }),
})
