"""What LLM prompt-cache detection would file, and every reason it would not.

Counts go to metrics, the detail of each candidate to a log line. Every run
re-reads the same trailing window, so consecutive runs report largely the same
call sites: compare runs, never sum across them.
"""

from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import sentry_sdk

from sentry.llm_cache_detection.detection import (
    FLAGGED_OUTCOMES,
    CacheFinding,
    CallSiteStats,
    CallSiteWarmth,
    Classification,
    DetectionWindow,
    ProbeGap,
    PromptDiagnosisGap,
    PromptDivergence,
)
from sentry.llm_cache_detection.pricing import PricingGap, SavingsEstimate
from sentry.llm_cache_detection.query import CallSiteQueryResult, SampleCall
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
    sample_calls: Sequence[SampleCall] | ProbeGap | None = None
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


def _call_site_fields(stats: CallSiteStats) -> dict[str, Any]:
    return {
        "agent_label": stats.agent_label,
        "agent_label_source": stats.agent_label_source.value,
        "span_name": stats.span_name,
        "model": stats.model,
        "call_count": stats.call_count,
        "sampled_call_count": stats.sampled_call_count,
        "avg_input_tokens": stats.avg_input_tokens,
        "sum_input_tokens": stats.sum_input_tokens,
        "sum_cache_read_tokens": stats.sum_cache_read_tokens,
        "sum_cache_creation_tokens": stats.sum_cache_creation_tokens,
        "uncached_tokens": stats.uncached_tokens,
        "unrecouped_cache_write_tokens": stats.unrecouped_cache_write_tokens,
        "hit_rate": stats.hit_rate,
        "write_read_ratio": stats.write_read_ratio,
        "cache_exceeds_input": stats.cache_exceeds_input,
    }


def _warmth_fields(warmth: CallSiteWarmth | ProbeGap | None) -> dict[str, Any]:
    if warmth is None:
        return {}
    if isinstance(warmth, ProbeGap):
        return {"warmth_gap": warmth.value}
    return {
        "total_call_count": warmth.total_call_count,
        "warm_call_count": warmth.warm_call_count,
        "cacheable_share": warmth.cacheable_share,
    }


def _presence_fields(spans_with_cache_attributes: int | ProbeGap | None) -> dict[str, Any]:
    if spans_with_cache_attributes is None:
        return {}
    if isinstance(spans_with_cache_attributes, ProbeGap):
        return {"cache_presence_gap": spans_with_cache_attributes.value}
    return {"spans_with_cache_attributes": spans_with_cache_attributes}


def _anchor_fields(finding: CacheFinding) -> dict[str, Any]:
    anchor = finding.anchor
    if anchor is None:
        return {}
    return {
        "contrast_agent_label": anchor.agent_label,
        "contrast_agent_label_source": anchor.agent_label_source.value,
        "contrast_span_name": anchor.span_name,
        "contrast_hit_rate": anchor.hit_rate,
        "contrast_call_count": anchor.call_count,
        "contrast_avg_input_tokens": anchor.avg_input_tokens,
    }


def _pricing_fields(pricing: SavingsEstimate | PricingGap | None) -> dict[str, Any]:
    if pricing is None:
        return {}
    if isinstance(pricing, PricingGap):
        return {"pricing_gap": pricing.value}
    return {
        "estimated_savings_usd": pricing.estimated_savings_usd,
        "overpay_vs_no_cache_usd": pricing.overpay_vs_no_cache_usd,
        "price_per_input_token": pricing.price_per_input_token,
        "price_per_cached_input_token": pricing.price_per_cached_input_token,
        "price_per_cache_write_token": pricing.price_per_cache_write_token,
    }


def _sample_call_fields(sample_calls: Sequence[SampleCall] | ProbeGap | None) -> dict[str, Any]:
    if sample_calls is None:
        return {}
    if isinstance(sample_calls, ProbeGap):
        return {"sample_calls_gap": sample_calls.value}
    return {
        "sample_calls": [
            {
                "trace_id": sample.trace_id,
                "span_id": sample.span_id,
                "timestamp": sample.timestamp,
                "input_tokens": sample.input_tokens,
                "cache_read_tokens": sample.cache_read_tokens,
                "cache_creation_tokens": sample.cache_creation_tokens,
            }
            for sample in sample_calls
        ]
    }


def _prompt_diagnosis_fields(
    prompt_diagnosis: PromptDivergence | PromptDiagnosisGap | None,
) -> dict[str, Any]:
    if prompt_diagnosis is None:
        return {}
    if isinstance(prompt_diagnosis, PromptDiagnosisGap):
        return {"prompt_diagnosis_gap": prompt_diagnosis.value}
    return {
        "prompt_sample_count": prompt_diagnosis.sample_count,
        "prompt_common_prefix_chars": prompt_diagnosis.common_prefix_chars,
        "prompt_shortest_chars": prompt_diagnosis.shortest_prompt_chars,
        "prompt_prefix_share": prompt_diagnosis.prefix_share,
        "prompt_divergence_kind": prompt_diagnosis.divergence_kind.value,
        "prompt_stable_block_chars": prompt_diagnosis.stable_block_chars,
        "prompt_template_misordered": prompt_diagnosis.template_misordered,
    }


def _report_candidate(project: Project, window: DetectionWindow, report: CandidateReport) -> None:
    finding = report.finding
    classification = finding.classification
    logger.info(
        "llm_cache_issue_detection.candidate_resolved",
        extra={
            **_project_attributes(project),
            "window_start": window.start.isoformat(),
            "window_end": window.end.isoformat(),
            "rank": report.rank,
            "severity": finding.severity,
            "initial_outcome": report.initial.outcome.value,
            "initial_reason": report.initial.reason.value,
            "outcome": classification.outcome.value,
            "reason": classification.reason.value,
            "disposition": report.disposition.value if report.disposition else None,
            **_call_site_fields(finding.stats),
            **_warmth_fields(finding.warmth),
            **_presence_fields(finding.spans_with_cache_attributes),
            **_anchor_fields(finding),
            **_pricing_fields(report.pricing),
            **_sample_call_fields(report.sample_calls),
            **_prompt_diagnosis_fields(report.prompt_diagnosis),
        },
    )

    if report.disposition is None:
        return

    priced = isinstance(report.pricing, SavingsEstimate)
    _count(
        "findings",
        outcome=classification.outcome.value,
        reason=classification.reason.value,
        disposition=report.disposition.value,
        priced=priced,
        has_anchor=finding.anchor is not None,
        model=finding.stats.model,
        **_project_attributes(project),
    )

    finding_attributes = {
        "outcome": classification.outcome.value,
        "disposition": report.disposition.value,
        **_project_attributes(project),
    }
    _distribution("finding.hit_rate", finding.stats.hit_rate, **finding_attributes)
    _distribution("finding.call_count", finding.stats.call_count, **finding_attributes)
    if isinstance(finding.warmth, CallSiteWarmth):
        _distribution(
            "finding.cacheable_share", finding.warmth.cacheable_share, **finding_attributes
        )
    if isinstance(report.pricing, SavingsEstimate):
        _distribution(
            "finding.estimated_savings_usd",
            report.pricing.estimated_savings_usd,
            **finding_attributes,
        )

    if isinstance(report.pricing, SavingsEstimate):
        _count("pricing", result="priced", model=finding.stats.model)
    elif report.pricing is not None:
        _count("pricing", result=report.pricing.value, model=finding.stats.model)
    prompt_diagnosis = report.prompt_diagnosis
    if isinstance(prompt_diagnosis, PromptDivergence):
        _count(
            "prompt_diagnosis",
            result="diagnosed",
            kind=prompt_diagnosis.divergence_kind.value,
            template_misordered=prompt_diagnosis.template_misordered,
        )
    elif prompt_diagnosis is not None:
        _count("prompt_diagnosis", result=prompt_diagnosis.value)


def _report_call_sites(
    project: Project,
    query_result: CallSiteQueryResult,
    classified: Iterable[tuple[CallSiteStats, Classification]],
) -> None:
    project_attributes = _project_attributes(project)

    tally: Counter[tuple[str, str, str, str]] = Counter()
    for stats, classification in classified:
        tally[
            (
                classification.outcome.value,
                classification.reason.value,
                stats.agent_label_source.value,
                stats.model,
            )
        ] += 1
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


def report_project(
    project: Project,
    window: DetectionWindow,
    query_result: CallSiteQueryResult,
    non_candidates: Sequence[tuple[CallSiteStats, Classification]],
    candidates: Sequence[CandidateReport],
    probes_sent: dict[str, int],
) -> None:
    """Report one project's run: each candidate, the tallies, and a summary."""
    for report in candidates:
        _report_candidate(project, window, report)

    _report_call_sites(
        project,
        query_result,
        [
            *non_candidates,
            *((report.finding.stats, report.finding.classification) for report in candidates),
        ],
    )

    outcome_reasons = Counter(
        f"{classification.outcome.value}:{classification.reason.value}"
        for classification in (
            *(classification for _, classification in non_candidates),
            *(report.finding.classification for report in candidates),
        )
    )
    dispositions = Counter(
        report.disposition.value for report in candidates if report.disposition is not None
    )
    logger.info(
        "llm_cache_issue_detection.project_processed",
        extra={
            **_project_attributes(project),
            "window_start": window.start.isoformat(),
            "window_end": window.end.isoformat(),
            "call_site_count": len(query_result.call_sites),
            "truncated": query_result.truncated,
            "dropped_calls": {
                reason.value: calls for reason, calls in query_result.dropped_calls.items()
            },
            "cache_exceeds_input_count": sum(
                1 for stats in query_result.call_sites if stats.cache_exceeds_input
            ),
            "candidate_count": len(candidates),
            "finding_count": sum(
                1 for report in candidates if report.finding.outcome in FLAGGED_OUTCOMES
            ),
            "outcome_reasons": dict(outcome_reasons),
            "dispositions": dict(dispositions),
            "probes_sent": probes_sent,
        },
    )
