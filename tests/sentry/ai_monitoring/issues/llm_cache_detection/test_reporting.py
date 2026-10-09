from __future__ import annotations

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    CacheFinding,
    CacheOutcome,
    CallSiteWarmth,
    Classification,
    OutcomeReason,
    ProbeGap,
)
from sentry.ai_monitoring.issues.llm_cache_detection.pricing import PricingGap, SavingsEstimate
from sentry.ai_monitoring.issues.llm_cache_detection.query import SampleCall
from sentry.ai_monitoring.issues.llm_cache_detection.reporting import (
    CandidateReport,
    Disposition,
    _candidate_fields,
)
from tests.sentry.ai_monitoring.issues.llm_cache_detection.test_utils import make_stats

INITIAL = Classification(CacheOutcome.NOT_CACHING, OutcomeReason.CACHE_ACTIVITY)
FINAL = Classification(CacheOutcome.THRASH, OutcomeReason.CACHE_ACTIVITY)


def test_candidate_fields_include_evidence_and_enrichment() -> None:
    finding = CacheFinding(
        classification=FINAL,
        stats=make_stats(model="claude-sonnet-4", hit_rate=0.1, write_read_ratio=2),
        warmth=CallSiteWarmth(1_000, 500, 800, 900),
        spans_with_cache_attributes=400,
    )
    report = CandidateReport(
        finding=finding,
        initial=INITIAL,
        rank=2,
        disposition=Disposition.WOULD_CREATE,
        pricing=SavingsEstimate(12.5, 0.000003, 0.0000003, 0.00000375),
        sample_calls=[SampleCall("trace-id", "span-id", "2026-01-01T00:00:00Z", 4_000, 100, 200)],
    )

    fields = _candidate_fields(report)

    assert fields["rank"] == 2
    assert fields["initial_outcome"] == "not_caching"
    assert fields["outcome"] == "thrash"
    assert fields["disposition"] == "would_create"
    assert fields["cacheable_share"] == 0.8
    assert fields["spans_with_cache_attributes"] == 400
    assert fields["estimated_savings_usd"] == 12.5
    assert fields["sample_calls"][0]["trace_id"] == "trace-id"
    assert fields["min_cacheable_prefix_tokens"] == 1_024


def test_candidate_fields_explain_missing_measurements() -> None:
    finding = CacheFinding(
        classification=FINAL,
        stats=make_stats(),
        warmth=ProbeGap.OUT_OF_TIME,
        spans_with_cache_attributes=ProbeGap.UNQUERYABLE,
    )
    report = CandidateReport(
        finding=finding,
        initial=INITIAL,
        rank=1,
        pricing=PricingGap.NO_METADATA,
        sample_calls=ProbeGap.FAILED,
    )

    fields = _candidate_fields(report)

    assert fields["warmth_gap"] == "out_of_time"
    assert fields["cache_presence_gap"] == "unqueryable_call_site"
    assert fields["pricing_gap"] == "no_metadata"
    assert fields["sample_calls_gap"] == "probe_failed"
