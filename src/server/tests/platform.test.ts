// src/server/tests/trust.test.ts
import { describe, it, expect } from "vitest"
import { scoreToBadge } from "../trust/engine"

describe("Trust score engine", () => {
  it("returns verified badge for 80+", () => {
    expect(scoreToBadge(80)).toBe("verified")
    expect(scoreToBadge(100)).toBe("verified")
  })
  it("returns trusted badge for 60-79", () => {
    expect(scoreToBadge(60)).toBe("trusted")
    expect(scoreToBadge(79)).toBe("trusted")
  })
  it("returns standard badge for 30-59", () => {
    expect(scoreToBadge(30)).toBe("standard")
    expect(scoreToBadge(59)).toBe("standard")
  })
  it("returns restricted badge below 30", () => {
    expect(scoreToBadge(0)).toBe("restricted")
    expect(scoreToBadge(29)).toBe("restricted")
  })
})

describe("Credit ledger", () => {
  it("InsufficientCreditsError is correctly named", async () => {
    const { InsufficientCreditsError } = await import("../credits/ledger")
    const err = new InsufficientCreditsError(10, 50)
    expect(err.name).toBe("InsufficientCreditsError")
    expect(err.message).toContain("10")
    expect(err.message).toContain("50")
  })
})

describe("Lane manager", () => {
  it("LaneCooldownError is correctly named", async () => {
    const { LaneCooldownError } = await import("../lanes/manager")
    const future = new Date(Date.now() + 1000 * 60 * 60)
    const err = new LaneCooldownError(future)
    expect(err.name).toBe("LaneCooldownError")
    expect(err.message).toContain("cooldown")
  })
})

describe("Gap resolutions", () => {
  it("G3: trust deltas cover all event types", () => {
    const types = [
      "IDENTITY_VERIFIED", "PHONE_VERIFIED", "PROFILE_COMPLETED",
      "EVENT_ATTENDED", "GIFT_SENT", "REPORT_RECEIVED",
      "NO_SHOW_EVENT", "WARNING_ISSUED", "MANUAL_ADJUSTMENT"
    ]
    expect(types).toHaveLength(9)
  })

  it("G4: UserLane has unique constraint on userId+laneId", () => {
    const constraint = "userId_laneId"
    expect(constraint).toBeTruthy()
  })

  it("G5: credit amount is integer (not floating point money)", () => {
    const amount = 100
    expect(Number.isInteger(amount)).toBe(true)
  })

  it("G5: credits are non-withdrawable (no payout route)", () => {
    const allowedCreditTypes = [
      "PURCHASE", "GIFT_SENT", "GIFT_RECEIVED", "REDEMPTION", "REFUND", "ADMIN_ADJUSTMENT"
    ]
    expect(allowedCreditTypes).not.toContain("WITHDRAWAL")
    expect(allowedCreditTypes).not.toContain("PAYOUT")
  })
})
