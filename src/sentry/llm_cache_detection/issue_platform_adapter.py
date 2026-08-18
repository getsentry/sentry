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
    DetectionWindow,
)
from sentry.llm_cache_detection.pricing import SavingsEstimate
from sentry.llm_cache_detection.query import SampleCall
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.tasks.llm_issue_detection.detection import get_base_platform
from sentry.utils.tracing import trace

FINDING_TITLES: dict[CacheOutcome, str] = {
    CacheOutcome.NOT_CACHING: "Uncached LLM Prompts",
    CacheOutcome.THRASH: "LLM Cache Thrash",
}


# Versioned so grouping can change later without merging into existing issues.
FINGERPRINT_VERSION = "v1"


def create_fingerprint(stats: CallSiteStats) -> str:
    """Identify a call site, independently of which diagnosis it currently draws.

    The outcome is deliberately excluded: the two outcomes are alternative
    readings of the same call site, so including it would open a second issue
    whenever one shifted and orphan the first, which never auto-resolves.
    """
    # The parts are arbitrary strings off a span, so they are length-prefixed
    # rather than joined on a delimiter: any delimiter can occur inside a
    # transaction or a span description, which would let two distinct call sites
    # hash alike and share one issue.
    call_site = "".join(
        f"{len(part)}:{part}" for part in (stats.transaction, stats.span_description, stats.model)
    )
    prehashed_fingerprint = f"llm-cache-detection-{FINGERPRINT_VERSION}-{call_site}"
    return hashlib.sha1(prehashed_fingerprint.encode()).hexdigest()


def _format_rate(rate: float) -> str:
    if rate == 0:
        return "0%"
    if rate < 0.0001:
        return "<0.01%"
    return f"{rate:.2%}"


def _format_tokens(value: float) -> str:
    """Render a token total approximately: it is extrapolated from sampled spans,
    so digit-exact precision would overstate what is known."""
    if value < 1_000:
        return f"{value:,.0f}"
    if value < 1_000_000:
        return f"~{value / 1_000:.1f}K"
    return f"~{value / 1_000_000:.1f}M"


def _format_usd(value: float) -> str:
    """Render an amount at the precision the estimate actually supports."""
    if value < 0.01:
        return "<$0.01"
    if value < 1_000:
        return f"${value:,.2f}"
    return f"${value:,.0f}"


def _format_call_site(stats: CallSiteStats) -> str:
    """Name the call site for a human, without repeating itself.

    The model is a grouping dimension in its own right, so it has to appear when
    the description does not already carry it. Gen-AI span descriptions
    conventionally end in the model (``generate_content claude-sonnet-4``),
    though, and appending it again spends the issue stream's limited width on a
    duplicate -- which is exactly the part that then gets truncated away.
    """
    parts = [stats.transaction, stats.span_description]
    if stats.model.casefold() not in stats.span_description.casefold():
        parts.append(stats.model)
    return " | ".join(parts)


@trace
def send_llm_cache_issue_to_platform(
    project: Project,
    finding: CacheFinding,
    sample_calls: list[SampleCall],
    window: DetectionWindow,
    savings: SavingsEstimate | None,
) -> None:
    """Produce an occurrence for a flagged call-site group."""
    stats = finding.stats
    fingerprint = create_fingerprint(stats)
    anchor = finding.anchor
    now = datetime.now(UTC)
    event_id = uuid4().hex

    call_site = _format_call_site(stats)
    write_read_ratio = stats.write_read_ratio

    evidence_data: dict[str, Any] = {
        # The two outcomes render differently and can swap between runs on one
        # issue, so the reading has to be a field rather than inferred from the
        # title, which is copy.
        "outcome": finding.outcome.value,
        "window_days": DETECTION_WINDOW_DAYS,
        "window_start": window.start.isoformat(),
        "window_end": window.end.isoformat(),
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
        "sample_trace_ids": [sample.trace_id for sample in sample_calls],
        "sample_traces": [
            {
                "trace_id": sample.trace_id,
                "span_id": sample.span_id,
                "timestamp": sample.timestamp,
                "input_tokens": sample.input_tokens,
                "cache_read_tokens": sample.cache_read_tokens,
                "cache_creation_tokens": sample.cache_creation_tokens,
            }
            for sample in sample_calls
        ],
    }

    if savings is not None:
        evidence_data.update(
            {
                "estimated_savings_usd": savings.estimated_savings_usd,
                "price_per_input_token": savings.price_per_input_token,
                "price_per_cached_input_token": savings.price_per_cached_input_token,
                "price_per_cache_write_token": savings.price_per_cache_write_token,
            }
        )
        if savings.overpay_vs_no_cache_usd is not None:
            evidence_data["overpay_vs_no_cache_usd"] = savings.overpay_vs_no_cache_usd

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
        *(
            [
                IssueEvidence(
                    name="Avoidable spend",
                    value=_format_usd(savings.estimated_savings_usd),
                    important=False,
                )
            ]
            if savings is not None
            else []
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
                "contrast_call_count": anchor.call_count,
                "contrast_avg_input_tokens": anchor.avg_input_tokens,
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

    if sample_calls:
        evidence_display.append(
            IssueEvidence(
                name="Sample traces",
                value=", ".join(sample.trace_id for sample in sample_calls),
                important=False,
            )
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
    if sample_calls:
        event_data["contexts"] = {
            "trace": {
                "trace_id": sample_calls[0].trace_id,
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


def check_llm_cache_issue_already_speaks_for(
    project: Project, fingerprint: str, window: DetectionWindow
) -> bool:
    """Whether an existing issue already covers this call site.

    Detection runs far more often than its own window is long, so a finding
    survives in the aggregates for the whole window after the code behind it
    changed. An occurrence produced in that period is stale evidence, and the
    issue platform reads one against a resolved group as a regression -- which
    would reopen the issue every run for the rest of the window, right after
    someone fixed and closed it.

    So a resolved issue only reopens once the window no longer overlaps the
    resolution, by which point the finding is about traffic that postdates the
    fix. An archived issue is left alone entirely: this type does not escalate,
    so archiving is the reader saying they do not want to hear about it again.
    """
    fingerprint_hash = hash_fingerprint([fingerprint])[0]

    groups = Group.objects.filter(
        grouphash__project_id=project.id,
        grouphash__hash=fingerprint_hash,
    )
    if groups.filter(status__in=(GroupStatus.UNRESOLVED, GroupStatus.IGNORED)).exists():
        return True

    # A null resolved_at is treated as a recent resolution: reopening on an
    # unknown date is the failure that spams, and the finding returns anyway if
    # the call site is still bad once a later window closes.
    return groups.filter(status=GroupStatus.RESOLVED).exclude(resolved_at__lt=window.start).exists()
