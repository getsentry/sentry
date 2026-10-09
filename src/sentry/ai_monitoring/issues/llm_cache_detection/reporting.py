"""Structured shadow reports for LLM prompt-cache detection."""

from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from enum import StrEnum
from typing import Any

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    CacheFinding,
    CallSiteStats,
    CallSiteWarmth,
    Classification,
    DetectionWindow,
    ProbeGap,
    min_cacheable_prefix_tokens,
)
from sentry.ai_monitoring.issues.llm_cache_detection.pricing import PricingGap, SavingsEstimate
from sentry.ai_monitoring.issues.llm_cache_detection.query import (
    CallSiteQueryResult,
    SampleCall,
)
from sentry.models.project import Project

logger = logging.getLogger(__name__)


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


def _project_fields(project: Project) -> dict[str, str]:
    return {"project_id": str(project.id), "organization_id": str(project.organization_id)}


def report_project(
    project: Project,
    window: DetectionWindow,
    query_result: CallSiteQueryResult,
    non_candidates: Sequence[tuple[CallSiteStats, Classification]],
    candidates: Sequence[CandidateReport],
    warmth_probes_sent: int,
) -> None:
    """Log candidate decisions and one project summary for a detection run."""
    window_fields = {
        "window_start": window.start.isoformat(),
        "window_end": window.end.isoformat(),
    }
    for report in candidates:
        logger.info(
            "llm_cache_issue_detection.candidate_resolved",
            extra={
                **_project_fields(project),
                **window_fields,
                **_candidate_fields(report),
            },
        )

    classified = [
        *non_candidates,
        *((report.finding.stats, report.finding.classification) for report in candidates),
    ]
    classifications = Counter(
        (
            classification.outcome.value,
            classification.reason.value,
            stats.agent_label_source.value,
            stats.model,
        )
        for stats, classification in classified
    )
    anomalies = Counter(
        stats.model for stats in query_result.call_sites if stats.cache_exceeds_input
    )
    dispositions = Counter(
        report.disposition.value for report in candidates if report.disposition is not None
    )
    logger.info(
        "llm_cache_issue_detection.project_processed",
        extra={
            **_project_fields(project),
            **window_fields,
            "truncated": query_result.truncated,
            "dropped_calls": {
                reason.value: calls for reason, calls in query_result.dropped_calls.items()
            },
            "cache_exceeds_input_models": dict(anomalies),
            "candidate_count": len(candidates),
            "classifications": [
                {
                    "outcome": outcome,
                    "reason": reason,
                    "label_source": label_source,
                    "model": model,
                    "count": count,
                }
                for (outcome, reason, label_source, model), count in classifications.items()
            ],
            "dispositions": dict(dispositions),
            "warmth_probes_sent": warmth_probes_sent,
        },
    )
