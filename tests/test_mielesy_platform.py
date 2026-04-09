"""Tests for mielesy-platform — TrustEngine Blueprint v2.0 canonical deltas."""
import pytest
try:
    from mielesy.trust_engine import TrustEngine, TrustRecord, TRUST_DELTAS, INITIAL_TRUST
    HAS = True
except ImportError:
    HAS = False

def test_canonical_deltas():
    assert TRUST_DELTAS["GIFT_SENT"] == +2
    assert TRUST_DELTAS["REPORT_RECEIVED"] == -20
    assert TRUST_DELTAS["NO_SHOW_EVENT"] == -10
    assert TRUST_DELTAS["CHARGEBACK_FILED"] == -25
    assert TRUST_DELTAS["INACTIVITY_90_DAYS"] == -5

def test_initial_trust():
    assert INITIAL_TRUST == 500

def test_register_user():
    if not HAS: pytest.skip()
    e = TrustEngine()
    rec = e.register_user("u001")
    assert rec.score == INITIAL_TRUST

def test_record_event_positive():
    if not HAS: pytest.skip()
    e = TrustEngine()
    e.register_user("u001")
    score = e.record_event("u001", "EVENT_ATTENDED")
    assert score == INITIAL_TRUST + 5

def test_record_event_negative():
    if not HAS: pytest.skip()
    e = TrustEngine()
    e.register_user("u001")
    score = e.record_event("u001", "REPORT_RECEIVED")
    assert score == INITIAL_TRUST - 20

def test_score_floor():
    if not HAS: pytest.skip()
    e = TrustEngine()
    e.register_user("u001", initial=10)
    for _ in range(5):
        e.record_event("u001", "CHARGEBACK_FILED")
    assert e.score("u001") >= 0

def test_score_ceiling():
    if not HAS: pytest.skip()
    e = TrustEngine()
    e.register_user("u001", initial=990)
    for _ in range(20):
        e.record_event("u001", "EVENT_ATTENDED")
    assert e.score("u001") <= 1000

def test_tier_platinum():
    if not HAS: pytest.skip()
    e = TrustEngine()
    e.register_user("u001", initial=850)
    assert e.tier("u001") == "PLATINUM"

def test_tier_bronze():
    if not HAS: pytest.skip()
    e = TrustEngine()
    e.register_user("u001", initial=200)
    assert e.tier("u001") == "BRONZE"

def test_leaderboard_sorted():
    if not HAS: pytest.skip()
    e = TrustEngine()
    e.register_user("u1", initial=700)
    e.register_user("u2", initial=900)
    e.register_user("u3", initial=500)
    lb = e.leaderboard()
    scores = [r["score"] for r in lb]
    assert scores == sorted(scores, reverse=True)

def test_summary():
    if not HAS: pytest.skip()
    e = TrustEngine()
    e.register_user("u1")
    s = e.summary()
    assert "total_users" in s and "deltas" in s
