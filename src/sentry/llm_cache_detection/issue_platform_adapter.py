"""Builds issue-platform occurrences for LLM prompt-cache findings."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sentry.issues.grouptype import LLMCacheUsageGroupType
from sentry.issues.ingest import hash_fingerprint
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.llm_cache_detection.detection import (
    DETECTION_WINDOW_DAYS,
    CacheFinding,
    CacheOutcome,
    CallSiteStats,
)
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.tasks.llm_issue_detection.detection import get_base_platform
from sentry.utils.tracing import trace

FINDING_TITLES: dict[CacheOutcome, str] = {
    CacheOutcome.NOT_CACHING: "Uncached LLM Prompts",
    CacheOutcome.THRASH: "LLM Cache Thrash",
}


def create_fingerprint(outcome: CacheOutcome, stats: CallSiteStats) -> str:
    prehashed_fingerprint = (
        f"llm-cache-detection-{outcome.value}-"
        f"{stats.transaction}-{stats.span_description}-{stats.model}"
    )
    return hashlib.sha1(prehashed_fingerprint.encode()).hexdigest()


def _format_rate(rate: float) -> str:
    if rate == 0:
        return "0%"
    if rate < 0.0001:
        return "<0.01%"
    return f"{rate:.2%}"


def _format_tokens(value: float) -> str:
    return f"{value:,.0f}"


@trace
def send_llm_cache_issue_to_platform(
    project: Project, finding: CacheFinding, sample_trace_ids: list[str]
) -> None:
    """Produce an occurrence for a flagged call-site group."""
    stats = finding.stats
    fingerprint = create_fingerprint(finding.outcome, stats)
    anchor = finding.anchor
    now = datetime.now(UTC)
    event_id = uuid4().hex

    call_site = f"{stats.transaction} | {stats.span_description} | {stats.model}"
    write_read_ratio = stats.write_read_ratio

    evidence_data: dict[str, Any] = {
        "window_days": DETECTION_WINDOW_DAYS,
        "transaction": stats.transaction,
        "span_description": stats.span_description,
        "model": stats.model,
        "call_count": stats.call_count,
        "hit_rate": stats.hit_rate,
        "write_read_ratio": write_read_ratio,
        "avg_input_tokens": stats.avg_input_tokens,
        "uncached_tokens": stats.uncached_tokens,
        "sum_input_tokens": stats.sum_input_tokens,
        "sum_cache_read_tokens": stats.sum_cache_read_tokens,
        "sum_cache_creation_tokens": stats.sum_cache_creation_tokens,
        "sample_trace_ids": sample_trace_ids,
    }

    # Exactly one row per outcome is important: integrations render only the
    # first important row, so it must carry the finding's distinguishing number.
    evidence_display = [
        IssueEvidence(name="Call site", value=call_site, important=False),
        IssueEvidence(name="Window", value=f"{DETECTION_WINDOW_DAYS}d", important=False),
        IssueEvidence(name="Calls", value=f"{stats.call_count:,}", important=False),
        IssueEvidence(
            name="Cache hit rate",
            value=_format_rate(stats.hit_rate),
            important=finding.outcome == CacheOutcome.NOT_CACHING,
        ),
        IssueEvidence(
            name="Cache write:read ratio",
            value=(
                f"{write_read_ratio:.1f}:1" if write_read_ratio is not None else "no cache reads"
            ),
            important=finding.outcome == CacheOutcome.THRASH,
        ),
        IssueEvidence(
            name="Avg input tokens", value=_format_tokens(stats.avg_input_tokens), important=False
        ),
        IssueEvidence(
            name="Uncached tokens", value=_format_tokens(stats.uncached_tokens), important=False
        ),
        IssueEvidence(
            name="Total input tokens",
            value=_format_tokens(stats.sum_input_tokens),
            important=False,
        ),
        IssueEvidence(
            name="Cache read tokens",
            value=_format_tokens(stats.sum_cache_read_tokens),
            important=False,
        ),
        IssueEvidence(
            name="Cache write tokens",
            value=_format_tokens(stats.sum_cache_creation_tokens),
            important=False,
        ),
    ]

    if anchor is not None:
        evidence_data.update(
            {
                "contrast_model": anchor.model,
                "contrast_transaction": anchor.transaction,
                "contrast_span_description": anchor.span_description,
                "contrast_hit_rate": anchor.hit_rate,
            }
        )
        evidence_display.append(
            IssueEvidence(
                name="Healthy comparison",
                value=(
                    f"{anchor.model} reaches {_format_rate(anchor.hit_rate)} cache hit rate at "
                    f"{anchor.transaction} | {anchor.span_description}"
                ),
                important=False,
            )
        )

    if sample_trace_ids:
        evidence_display.append(
            IssueEvidence(name="Sample traces", value=", ".join(sample_trace_ids), important=False)
        )

    event_data: dict[str, Any] = {
        "event_id": event_id,
        "project_id": project.id,
        # The occurrence consumer's event schema rejects a null platform.
        "platform": get_base_platform(project.platform) or "other",
        "timestamp": now.isoformat(),
        "received": now.isoformat(),
        "tags": {
            "transaction": stats.transaction,
            "gen_ai.request.model": stats.model,
        },
    }
    if sample_trace_ids:
        event_data["contexts"] = {
            "trace": {
                "trace_id": sample_trace_ids[0],
                "type": "trace",
            }
        }

    occurrence = IssueOccurrence(
        id=uuid4().hex,
        event_id=event_id,
        project_id=project.id,
        fingerprint=[fingerprint],
        issue_title=FINDING_TITLES[finding.outcome],
        subtitle=call_site,
        resource_id=None,
        evidence_data=evidence_data,
        evidence_display=evidence_display,
        type=LLMCacheUsageGroupType,
        detection_time=now,
        culprit=stats.transaction,
        level="warning",
    )

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE, occurrence=occurrence, event_data=event_data
    )


def check_unresolved_llm_cache_issue_exists(project: Project, fingerprint: str) -> bool:
    fingerprint_hash = hash_fingerprint([fingerprint])[0]

    return Group.objects.filter(
        grouphash__project_id=project.id,
        grouphash__hash=fingerprint_hash,
        status=GroupStatus.UNRESOLVED,
    ).exists()
