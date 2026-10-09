"""Structured shadow reports for LLM prompt-cache detection."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import StrEnum
from typing import Any

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    CacheFinding,
    CallSiteWarmth,
    Classification,
    ProbeGap,
    min_cacheable_prefix_tokens,
)
from sentry.ai_monitoring.issues.llm_cache_detection.pricing import PricingGap, SavingsEstimate
from sentry.ai_monitoring.issues.llm_cache_detection.query import SampleCall


class Disposition(StrEnum):
    """What issue creation would do with a finding."""

    WOULD_CREATE = "would_create"
    OVER_CAP = "over_cap"


@dataclass(frozen=True)
class CandidateReport:
    """A provisional candidate and its final shadow result."""

    finding: CacheFinding
    initial: Classification
    rank: int
    disposition: Disposition | None = None
    pricing: SavingsEstimate | PricingGap | None = None
    sample_calls: list[SampleCall] | ProbeGap | None = None


def _candidate_fields(report: CandidateReport) -> dict[str, Any]:
    finding = report.finding
    stats = finding.stats
    fields: dict[str, Any] = {
        "rank": report.rank,
        "severity": finding.severity,
        "initial_outcome": report.initial.outcome.value,
        "initial_reason": report.initial.reason.value,
        "outcome": finding.outcome.value,
        "reason": finding.classification.reason.value,
        "disposition": report.disposition.value if report.disposition else None,
        **asdict(stats),
        "hit_rate": stats.hit_rate,
        "write_read_ratio": stats.write_read_ratio,
        "uncached_tokens": stats.uncached_tokens,
        "unrecouped_cache_write_tokens": stats.unrecouped_cache_write_tokens,
        "cache_exceeds_input": stats.cache_exceeds_input,
        "min_cacheable_prefix_tokens": min_cacheable_prefix_tokens(stats.model),
    }

    for name, measurement in (
        ("warmth", finding.warmth),
        ("cache_presence", finding.spans_with_cache_attributes),
        ("pricing", report.pricing),
        ("sample_calls", report.sample_calls),
    ):
        if isinstance(measurement, StrEnum):
            fields[f"{name}_gap"] = measurement.value

    if isinstance(finding.warmth, CallSiteWarmth):
        fields.update(
            asdict(finding.warmth),
            cacheable_share=finding.warmth.cacheable_share,
            long_ttl_cacheable_share=finding.warmth.long_ttl_cacheable_share,
        )
    if isinstance(finding.spans_with_cache_attributes, int):
        fields["spans_with_cache_attributes"] = finding.spans_with_cache_attributes
    if isinstance(report.pricing, SavingsEstimate):
        fields.update(asdict(report.pricing))
    if isinstance(report.sample_calls, list):
        fields["sample_calls"] = [asdict(sample) for sample in report.sample_calls]
    return fields
