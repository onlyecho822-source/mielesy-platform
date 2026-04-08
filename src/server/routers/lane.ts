// src/server/routers/lane.ts
import { z } from "zod"
import { router, protectedProcedure } from "../trpc"
import { joinLane, leaveLane, getUserLanes, getLaneMembers } from "../lanes/manager"
import { db } from "../db"

export const laneRouter = router({
  all: protectedProcedure.query(() =>
    db.lane.findMany({ where: { isActive: true } })
  ),

  mine: protectedProcedure.query(({ ctx }) => getUserLanes(ctx.userId)),

  join: protectedProcedure
    .input(z.object({ laneId: z.string() }))
    .mutation(({ ctx, input }) => joinLane(ctx.userId, input.laneId)),

  leave: protectedProcedure
    .input(z.object({ laneId: z.string() }))
    .mutation(({ ctx, input }) => leaveLane(ctx.userId, input.laneId)),

  members: protectedProcedure
    .input(z.object({ laneId: z.string(), page: z.number().default(0) }))
    .query(({ input }) => getLaneMembers(input.laneId, input.page)),
})
