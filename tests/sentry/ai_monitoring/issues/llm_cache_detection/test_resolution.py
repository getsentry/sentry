from __future__ import annotations

from datetime import UTC, datetime
from unittest import mock

from sentry.ai_monitoring.issues.llm_cache_detection import resolution
from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    CacheFinding,
    CacheOutcome,
    CallSiteWarmth,
    Classification,
    DetectionWindow,
    OutcomeReason,
    ProbeGap,
)
from sentry.ai_monitoring.issues.llm_cache_detection.resolution import (
    ProbeBudget,
    probe,
    resolve_candidate,
)
from sentry.models.project import Project
from sentry.utils.snuba_rpc import SnubaRPCError
from tests.sentry.ai_monitoring.issues.llm_cache_detection.test_utils import make_stats

PROJECT = mock.Mock(spec=Project)
PROJECT.id = 1
PROJECT.organization_id = 2
WINDOW = DetectionWindow(
    start=datetime(2026, 1, 1, tzinfo=UTC),
    end=datetime(2026, 1, 8, tzinfo=UTC),
)


def test_probe_preserves_unanswered_reasons() -> None:
    budget = ProbeBudget(1)

    assert probe(PROJECT, "first", lambda: 1, float("inf"), budget) == 1
    assert probe(PROJECT, "over-budget", lambda: 2, float("inf"), budget) is (
        ProbeGap.BUDGET_EXHAUSTED
    )
    assert probe(PROJECT, "late", lambda: 3, -1) is ProbeGap.OUT_OF_TIME
    assert probe(PROJECT, "invalid-filter", lambda: None, float("inf")) is ProbeGap.UNQUERYABLE

    def fail() -> None:
        raise SnubaRPCError("timed out")

    with mock.patch.object(resolution.logger, "warning") as warning:
        assert probe(PROJECT, "failed", fail, float("inf")) is ProbeGap.FAILED
    assert warning.call_args.kwargs["extra"]["probe"] == "failed"


def test_resolve_candidate_checks_ambiguous_zero_instrumentation() -> None:
    candidate = CacheFinding(
        classification=Classification(CacheOutcome.NOT_CACHING, OutcomeReason.ZERO_CACHE_TOKENS),
        stats=make_stats(),
    )
    warmth = CallSiteWarmth(1_000, 1_000, 800, 800)

    with (
        mock.patch.object(resolution, "fetch_call_site_warmth", return_value=warmth),
        mock.patch.object(resolution, "count_spans_with_cache_attributes", return_value=12),
    ):
        finding = resolve_candidate(PROJECT, candidate, WINDOW, float("inf"), ProbeBudget(20))

    assert finding.classification == Classification(
        CacheOutcome.NOT_CACHING, OutcomeReason.EXPLICIT_ZERO_CACHE_TOKENS
    )
    assert finding.warmth == warmth
    assert finding.spans_with_cache_attributes == 12
