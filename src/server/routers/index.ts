// src/server/routers/index.ts
// Main tRPC router — all domain routers composed here

import { router } from "../trpc"
import { userRouter } from "./user"
import { laneRouter } from "./lane"
import { giftRouter } from "./gift"
import { eventRouter } from "./event"
import { creditRouter } from "./credit"
import { notificationRouter } from "./notification"
import { adminRouter } from "./admin"

export const appRouter = router({
  user:         userRouter,
  lane:         laneRouter,
  gift:         giftRouter,
  event:        eventRouter,
  credit:       creditRouter,
  notification: notificationRouter,
  admin:        adminRouter,
})

export type AppRouter = typeof appRouter
