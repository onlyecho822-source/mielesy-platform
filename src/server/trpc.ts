// src/server/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server"
import { type CreateNextContextOptions } from "@trpc/server/adapters/next"
import { getAuth } from "@clerk/nextjs/server"
import { db } from "./db"

export async function createTRPCContext(opts: CreateNextContextOptions) {
  const { userId: clerkId } = getAuth(opts.req)
  if (!clerkId) return { userId: null, db }

  const user = await db.user.findUnique({ where: { clerkId } })
  return { userId: user?.id ?? null, clerkId, db }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})
