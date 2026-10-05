"""What LLM prompt-cache detection would file, and every reason it would not.

Counts go to metrics, the detail of each candidate to a log line. Every run
re-reads the same trailing window, so consecutive runs report largely the same
call sites: compare runs, never sum across them.
"""

from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from enum import StrEnum
from typing import Any

import sentry_sdk

from sentry.llm_cache_issue_detection.detection import (
    CacheFinding,
    CallSiteStats,
    CallSiteWarmth,
    Classification,
    DetectionWindow,
    ProbeGap,
    PromptDiagnosisGap,
    PromptDivergence,
    min_cacheable_prefix_tokens,
)
from sentry.llm_cache_issue_detection.pricing import PricingGap, SavingsEstimate
from sentry.llm_cache_issue_detection.query import CallSiteQueryResult, SampleCall
from sentry.models.project import Project

logger = logging.getLogger(__name__)

METRIC_PREFIX = "llm_cache_issue_detection"


class Disposition(StrEnum):
    """What filing would do with a finding."""

    WOULD_CREATE = "would_create"
    # Ranked past the per-project cap, which mirrors the creation quota.
    OVER_CAP = "over_cap"


@dataclass(frozen=True)
class CandidateReport:
    """A call site the token sums flagged, and what became of it.

    ``initial`` is the classification from the sums alone, so a report shows
    what the probes changed. A candidate the probes resolved away has no
    disposition.
    """

    finding: CacheFinding
    initial: Classification
    # 1-based position in severity order among the project's candidates.
    rank: int
    disposition: Disposition | None = None
    pricing: SavingsEstimate | PricingGap | None = None
    sample_calls: list[SampleCall] | ProbeGap | None = None
    prompt_diagnosis: PromptDivergence | PromptDiagnosisGap | None = None


def _count(name: str, value: float = 1, /, **attributes: Any) -> None:
    sentry_sdk.metrics.count(f"{METRIC_PREFIX}.{name}", value, attributes=attributes)


def _distribution(name: str, value: float, /, **attributes: Any) -> None:
    sentry_sdk.metrics.distribution(f"{METRIC_PREFIX}.{name}", value, attributes=attributes)


def _project_attributes(project: Project) -> dict[str, str]:
    return {"project_id": str(project.id), "organization_id": str(project.organization_id)}


def report_fan_out_skipped(reason: str) -> None:
    _count("fan_out.skipped", reason=reason)


def report_projects_skipped(reason: str, amount: int = 1) -> None:
    _count("projects.skipped", amount, reason=reason)


def report_projects_dispatched(amount: int) -> None:
    _count("projects.dispatched", amount)


def report_probe_failed(project: Project, probe: str, error: Exception) -> None:
    _count("probe_failed", probe=probe, error=type(error).__name__, **_project_attributes(project))


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
    if finding.anchor is not None:
        fields.update({f"contrast_{key}": value for key, value in asdict(finding.anchor).items()})

    # Each measurement is either present or replaced by the reason it is not.
    measurements = {
        "warmth": finding.warmth,
        "cache_presence": finding.spans_with_cache_attributes,
        "pricing": report.pricing,
        "sample_calls": report.sample_calls,
        "prompt_diagnosis": report.prompt_diagnosis,
    }
    for name, measurement in measurements.items():
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
    if isinstance(report.prompt_diagnosis, PromptDivergence):
        divergence = report.prompt_diagnosis
        fields.update({f"prompt_{key}": value for key, value in asdict(divergence).items()})
        fields["prompt_prefix_share"] = divergence.prefix_share
        fields["prompt_template_misordered"] = divergence.template_misordered
    return fields


def _report_candidate(project: Project, window: DetectionWindow, report: CandidateReport) -> None:
    logger.info(
        "llm_cache_issue_detection.candidate_resolved",
        extra={
            **_project_attributes(project),
            "window_start": window.start.isoformat(),
            "window_end": window.end.isoformat(),
            **_candidate_fields(report),
        },
    )
    if report.disposition is None:
        return

    finding = report.finding
    attributes = {
        "outcome": finding.outcome.value,
        "disposition": report.disposition.value,
        **_project_attributes(project),
    }
    _count(
        "findings",
        reason=finding.classification.reason.value,
        priced=isinstance(report.pricing, SavingsEstimate),
        has_anchor=finding.anchor is not None,
        model=finding.stats.model,
        **attributes,
    )
    _distribution("finding.hit_rate", finding.stats.hit_rate, **attributes)
    _distribution("finding.call_count", finding.stats.call_count, **attributes)
    if isinstance(finding.warmth, CallSiteWarmth):
        _distribution("finding.cacheable_share", finding.warmth.cacheable_share, **attributes)

    if isinstance(report.pricing, SavingsEstimate):
        _distribution(
            "finding.estimated_savings_usd", report.pricing.estimated_savings_usd, **attributes
        )
        _count("pricing", result="priced", model=finding.stats.model)
    elif report.pricing is not None:
        _count("pricing", result=report.pricing.value, model=finding.stats.model)

    if isinstance(report.prompt_diagnosis, PromptDivergence):
        _count(
            "prompt_diagnosis",
            result="diagnosed",
            kind=report.prompt_diagnosis.divergence_kind.value,
            template_misordered=report.prompt_diagnosis.template_misordered,
        )
    elif report.prompt_diagnosis is not None:
        _count("prompt_diagnosis", result=report.prompt_diagnosis.value)


def report_project(
    project: Project,
    window: DetectionWindow,
    query_result: CallSiteQueryResult,
    non_candidates: Sequence[tuple[CallSiteStats, Classification]],
    candidates: Sequence[CandidateReport],
    warmth_probes_sent: int,
) -> None:
    """Report one project's run: each candidate, the tallies, and a summary."""
    for report in candidates:
        _report_candidate(project, window, report)

    project_attributes = _project_attributes(project)
    classified = [
        *non_candidates,
        *((report.finding.stats, report.finding.classification) for report in candidates),
    ]
    tally = Counter(
        (
            classification.outcome.value,
            classification.reason.value,
            stats.agent_label_source.value,
            stats.model,
        )
        for stats, classification in classified
    )
    for (outcome, reason, label_source, model), amount in tally.items():
        _count(
            "call_sites.classified",
            amount,
            outcome=outcome,
            reason=reason,
            label_source=label_source,
            model=model,
            **project_attributes,
        )

    anomalies = Counter(
        stats.model for stats in query_result.call_sites if stats.cache_exceeds_input
    )
    for model, amount in anomalies.items():
        _count("call_sites.cache_exceeds_input", amount, model=model, **project_attributes)
    for reason, calls in query_result.dropped_calls.items():
        if calls > 0:
            _count("calls_dropped", calls, reason=reason.value, **project_attributes)
    if query_result.truncated:
        _count("call_sites.truncated", **project_attributes)

    # Only a candidate still flagged after the probes gets a disposition.
    dispositions = Counter(
        report.disposition.value for report in candidates if report.disposition is not None
    )
    logger.info(
        "llm_cache_issue_detection.project_processed",
        extra={
            **project_attributes,
            "window_start": window.start.isoformat(),
            "window_end": window.end.isoformat(),
            "call_site_count": len(query_result.call_sites),
            "truncated": query_result.truncated,
            "dropped_calls": {
                reason.value: calls for reason, calls in query_result.dropped_calls.items()
            },
            "cache_exceeds_input_count": anomalies.total(),
            "candidate_count": len(candidates),
            "finding_count": dispositions.total(),
            "outcome_reasons": dict(
                Counter(
                    f"{classification.outcome.value}:{classification.reason.value}"
                    for _, classification in classified
                )
            ),
            "dispositions": dict(dispositions),
            "warmth_probes_sent": warmth_probes_sent,
        },
    )
