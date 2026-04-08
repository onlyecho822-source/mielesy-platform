// SCHEMA ADDENDUM — add to TrustEventType enum in schema.prisma
// These two values were missing from original build, found in blueprint v2.0

// In enum TrustEventType, add:
//   CHARGEBACK_FILED   (blueprint §3.2: -25, applied immediately)
//   INACTIVITY_90_DAYS (blueprint §3.2: -5, recovers on next login)
//
// Full corrected enum block:
//
// enum TrustEventType {
//   IDENTITY_VERIFIED
//   PHONE_VERIFIED
//   PROFILE_COMPLETED
//   EVENT_ATTENDED
//   GIFT_SENT
//   REPORT_RECEIVED
//   NO_SHOW_EVENT
//   WARNING_ISSUED
//   CHARGEBACK_FILED      ← ADD
//   INACTIVITY_90_DAYS    ← ADD
//   MANUAL_ADJUSTMENT
// }
//
// Run: npx prisma migrate dev --name add_trust_event_types
