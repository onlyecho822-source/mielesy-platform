"""
mielesy/trust_engine.py — Mielesy Trust Score Engine.
Tracks user trust scores with event-based deltas (Blueprint v2.0).
∇θ Operator — Echo Universe
"""
from __future__ import annotations
import hashlib, time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

# Trust delta map — canonical from Blueprint v2.0
TRUST_DELTAS = {
    "GIFT_SENT":          +2,
    "EVENT_ATTENDED":     +5,
    "PROFILE_VERIFIED":   +10,
    "REPORT_RECEIVED":    -20,
    "NO_SHOW_EVENT":      -10,
    "CHARGEBACK_FILED":   -25,
    "INACTIVITY_90_DAYS": -5,
    "REFERRAL_JOINED":    +8,
}

TRUST_FLOOR = 0
TRUST_CEILING = 1000
INITIAL_TRUST = 500


@dataclass
class TrustRecord:
    user_id: str
    score: int = INITIAL_TRUST
    events: List[Dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)

    def apply_delta(self, event: str, delta: int, note: str = "") -> int:
        self.score = max(TRUST_FLOOR, min(TRUST_CEILING, self.score + delta))
        self.events.append({"event": event, "delta": delta, "score_after": self.score,
                            "ts": time.time(), "note": note})
        return self.score

    def tier(self) -> str:
        if self.score >= 800: return "PLATINUM"
        if self.score >= 600: return "GOLD"
        if self.score >= 400: return "SILVER"
        return "BRONZE"

    def to_dict(self) -> Dict:
        return {"user_id": self.user_id, "score": self.score,
                "tier": self.tier(), "events": len(self.events)}


class TrustEngine:
    """Mielesy trust score management — Blueprint v2.0 canonical deltas."""

    def __init__(self):
        self._users: Dict[str, TrustRecord] = {}

    def register_user(self, user_id: str, initial: int = INITIAL_TRUST) -> TrustRecord:
        rec = TrustRecord(user_id=user_id, score=initial)
        self._users[user_id] = rec
        return rec

    def get(self, user_id: str) -> Optional[TrustRecord]:
        return self._users.get(user_id)

    def record_event(self, user_id: str, event: str, note: str = "") -> int:
        if user_id not in self._users:
            self.register_user(user_id)
        delta = TRUST_DELTAS.get(event, 0)
        return self._users[user_id].apply_delta(event, delta, note)

    def score(self, user_id: str) -> int:
        return self._users.get(user_id, TrustRecord("")).score

    def tier(self, user_id: str) -> str:
        return self._users.get(user_id, TrustRecord("")).tier()

    def leaderboard(self, top_n: int = 10) -> List[Dict]:
        ranked = sorted(self._users.values(), key=lambda r: r.score, reverse=True)
        return [r.to_dict() for r in ranked[:top_n]]

    def summary(self) -> Dict:
        return {"total_users": len(self._users),
                "avg_score": round(sum(r.score for r in self._users.values()) /
                              max(len(self._users), 1), 1),
                "deltas": TRUST_DELTAS}
