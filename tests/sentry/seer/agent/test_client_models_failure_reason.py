"""SeerRunState.failure_reason pass-through.

Seer classifies some run failures (currently "timeout" and "stalled") on the run state. The sentry
client model must declare the field or `Config.extra = "ignore"` silently drops it, leaving hooks
that fire on failure unable to tell why. It is additive/optional, so old seer responses still parse.
"""

from __future__ import annotations

from sentry.seer.agent.client_models import SeerRunState


def _state(**kwargs) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=[],
        updated_at="2024-01-01T00:00:00Z",
        **kwargs,
    )


def test_failure_reason_is_parsed_from_seer():
    assert _state(status="error", failure_reason="timeout").failure_reason == "timeout"


def test_failure_reason_defaults_to_none_for_old_seer():
    assert _state(status="error").failure_reason is None


def test_unclassified_failures_are_still_failures():
    # Most failures leave failure_reason unset, so status is what says a run failed.
    state = _state(status="error")
    assert state.status == "error"
    assert state.failure_reason is None


def test_unknown_failure_reason_still_parses():
    # A reason added on the seer side must not fail validation mid-deploy.
    assert _state(status="error", failure_reason="brand_new_reason").failure_reason == (
        "brand_new_reason"
    )
