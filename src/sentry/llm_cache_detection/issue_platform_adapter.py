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
    AgentLabelSource,
    CacheFinding,
    CacheOutcome,
    CallSiteStats,
    CallSiteWarmth,
    DetectionWindow,
    DivergenceKind,
    PromptDivergence,
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

# The row is named after where the label came from rather than carrying a
# qualifier in its value: an "Agent" row that is really an operation name reads
# as a mislabelled agent, and the distinction matters for finding the code.
AGENT_LABEL_EVIDENCE_NAMES: dict[AgentLabelSource, str] = {
    AgentLabelSource.AGENT_NAME: "Agent",
    AgentLabelSource.OPERATION_NAME: "Operation (no agent name)",
}

# Reads as the tail of "the prompts first differ at ...", and doubles as the rule
# for whether that row is worth showing at all. `NONE` and `OTHER` are absent
# deliberately: one has no first difference to name, and the other is the
# residual of a handful of patterns rather than a finding. Naming it would claim
# the divergence is not an id or a timestamp, when all that is known is that five
# regexes did not match near it.
DIVERGENCE_KIND_DESCRIPTIONS: dict[DivergenceKind, str] = {
    DivergenceKind.ISO_TIMESTAMP: "an ISO-8601 timestamp",
    DivergenceKind.EPOCH_TIMESTAMP: "a Unix timestamp",
    DivergenceKind.UUID: "a UUID",
    DivergenceKind.IDENTIFIER: "a request or trace id",
    DivergenceKind.COUNTER: "a changing number",
}

# Versioned so grouping can change later without merging into existing issues.
FINGERPRINT_VERSION = "v1"


def create_fingerprint(stats: CallSiteStats) -> str:
    """Identify a call site, independently of which diagnosis it currently draws.

    The outcome is deliberately excluded: the two outcomes are alternative
    readings of the same call site, so including it would open a second issue
    whenever one shifted and orphan the first, which never auto-resolves.

    The label's source is included because it distinguishes call sites rather
    than describing one: without it, an agent named after an operation would
    share an issue with the spans that have no agent name at all.
    """
    # The parts are arbitrary strings off a span, so they are length-prefixed
    # rather than joined on a delimiter: any delimiter can occur inside an agent
    # name or a span name, which would let two distinct call sites hash alike
    # and share one issue.
    call_site = "".join(
        f"{len(part)}:{part}"
        for part in (
            stats.agent_label_source.value,
            stats.agent_label,
            stats.span_name,
            stats.model,
        )
    )
    prehashed_fingerprint = f"llm-cache-detection-{FINGERPRINT_VERSION}-{call_site}"
    return hashlib.sha1(prehashed_fingerprint.encode()).hexdigest()


def _format_rate(rate: float) -> str:
    if rate == 0:
        return "0%"
    if rate < 0.0001:
        return "<0.01%"
    return f"{rate:.2%}"


def _format_magnitude(value: float) -> str:
    """Render a large count approximately.

    Token totals are extrapolated from sampled spans and prompt lengths are read
    off samples EAP may have truncated, so digit-exact precision would overstate
    what either is known to."""
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


def _format_call_site_label(agent_label: str, span_name: str, model: str | None = None) -> str:
    """Name a call site for a human, without repeating itself.

    Both the agent label and the model are grouping dimensions in their own
    right, so each has to appear when the span name does not already carry it.
    Gen-AI span names conventionally embed one or the other
    (``invoke_agent Lightweight RCA``, ``generate_content claude-sonnet-4``),
    though, and repeating one spends the issue stream's limited width on a
    duplicate -- which is exactly the part that then gets truncated away.
    """
    normalized_span_name = span_name.casefold()
    parts = [span_name]
    if agent_label.casefold() not in normalized_span_name:
        parts.insert(0, agent_label)
    if model is not None and model.casefold() not in normalized_span_name:
        parts.append(model)
    return " | ".join(parts)


def _format_call_site(stats: CallSiteStats) -> str:
    return _format_call_site_label(stats.agent_label, stats.span_name, stats.model)


def _build_evidence_data(
    finding: CacheFinding,
    sample_calls: list[SampleCall],
    window: DetectionWindow,
    savings: SavingsEstimate | None,
    divergence: PromptDivergence | None,
) -> dict[str, Any]:
    """The machine-readable half of the occurrence, which the issue page renders from."""
    stats = finding.stats
    evidence_data: dict[str, Any] = {
        # The two outcomes render differently and can swap between runs on one
        # issue, so the reading has to be a field rather than inferred from the
        # title, which is copy.
        "outcome": finding.outcome.value,
        "window_days": DETECTION_WINDOW_DAYS,
        "window_start": window.start.isoformat(),
        "window_end": window.end.isoformat(),
        "agent_label": stats.agent_label,
        # The attribute the label was read from, so a reader is not misled into
        # taking an operation name for an agent someone actually named.
        "agent_label_source": stats.agent_label_source.value,
        "span_name": stats.span_name,
        "model": stats.model,
        "call_count": stats.call_count,
        "hit_rate": stats.hit_rate,
        "write_read_ratio": stats.write_read_ratio,
        "avg_input_tokens": stats.avg_input_tokens,
        "uncached_tokens": stats.uncached_tokens,
        "sum_input_tokens": stats.sum_input_tokens,
        "sum_cache_read_tokens": stats.sum_cache_read_tokens,
        "sum_cache_creation_tokens": stats.sum_cache_creation_tokens,
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

    warmth = finding.warmth
    if warmth is not None:
        evidence_data.update(
            {
                # The hit rate is read against every call, so the share of them
                # a warm cache was available to is what says whether that rate
                # is a fault or the arithmetic of isolated traffic.
                "warm_call_count": warmth.warm_call_count,
                "cacheable_share": warmth.cacheable_share,
            }
        )

    if divergence is not None:
        evidence_data.update(
            {
                "prompt_sample_count": divergence.sample_count,
                "prompt_common_prefix_chars": divergence.common_prefix_chars,
                "prompt_shortest_chars": divergence.shortest_prompt_chars,
                "prompt_prefix_share": divergence.prefix_share,
                "prompt_divergence_kind": divergence.divergence_kind.value,
                "prompt_stable_block_chars": divergence.stable_block_chars,
                "prompt_template_misordered": divergence.template_misordered,
            }
        )

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

    anchor = finding.anchor
    if anchor is not None:
        evidence_data.update(
            {
                "contrast_model": anchor.model,
                "contrast_agent_label": anchor.agent_label,
                "contrast_agent_label_source": anchor.agent_label_source.value,
                "contrast_span_name": anchor.span_name,
                "contrast_hit_rate": anchor.hit_rate,
                "contrast_call_count": anchor.call_count,
                "contrast_avg_input_tokens": anchor.avg_input_tokens,
            }
        )

    return evidence_data


def _cache_eligible_calls_evidence(warmth: CallSiteWarmth | None) -> list[IssueEvidence]:
    """The calls that had a warm cache to hit, as a row -- or no row at all."""
    if warmth is None:
        return []
    return [
        IssueEvidence(
            name="Cache-eligible calls",
            value=(
                f"{warmth.warm_call_count:,.0f} ({_format_rate(warmth.cacheable_share)} of calls)"
            ),
            important=False,
        )
    ]


def _prompt_divergence_evidence(divergence: PromptDivergence | None) -> list[IssueEvidence]:
    """Where the sampled prompts stop agreeing, as rows -- or no rows at all.

    Stated as facts rather than as a verdict: what the numbers add up to depends
    on the template, which the reader has and the detector does not.
    """
    if divergence is None:
        return []
    rows = [
        IssueEvidence(
            name="Shared prompt prefix",
            value=(
                f"{_format_magnitude(divergence.common_prefix_chars)} chars across "
                f"{divergence.sample_count} sampled prompts "
                f"({_format_rate(divergence.prefix_share)})"
            ),
            important=False,
        )
    ]
    if divergence.divergence_kind in DIVERGENCE_KIND_DESCRIPTIONS:
        rows.append(
            IssueEvidence(
                name="Prompts first differ at",
                value=DIVERGENCE_KIND_DESCRIPTIONS[divergence.divergence_kind],
                important=False,
            )
        )
    if divergence.stable_block_chars > 0:
        rows.append(
            IssueEvidence(
                name="Identical block after it",
                value=f"{_format_magnitude(divergence.stable_block_chars)} chars",
                important=False,
            )
        )
    return rows


def _build_evidence_display(
    finding: CacheFinding,
    sample_calls: list[SampleCall],
    savings: SavingsEstimate | None,
    divergence: PromptDivergence | None,
) -> list[IssueEvidence]:
    """The human-readable half, as rows.

    Exactly one row per outcome is important: integrations render only the first
    important row, so it must carry the finding's distinguishing number.
    """
    stats = finding.stats
    write_read_ratio = stats.write_read_ratio

    evidence_display = [
        IssueEvidence(name="Call site", value=_format_call_site(stats), important=False),
        IssueEvidence(
            name=AGENT_LABEL_EVIDENCE_NAMES[stats.agent_label_source],
            value=stats.agent_label,
            important=False,
        ),
        IssueEvidence(name="Window", value=f"{DETECTION_WINDOW_DAYS}d", important=False),
        IssueEvidence(name="Calls", value=f"{stats.call_count:,}", important=False),
        *_cache_eligible_calls_evidence(finding.warmth),
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
    ]

    if savings is not None:
        evidence_display.append(
            IssueEvidence(
                name="Avoidable spend",
                value=_format_usd(savings.estimated_savings_usd),
                important=False,
            )
        )

    evidence_display += [
        IssueEvidence(
            name="Avg input tokens",
            value=_format_magnitude(stats.avg_input_tokens),
            important=False,
        ),
        IssueEvidence(
            name="Uncached tokens", value=_format_magnitude(stats.uncached_tokens), important=False
        ),
        IssueEvidence(
            name="Total input tokens",
            value=_format_magnitude(stats.sum_input_tokens),
            important=False,
        ),
        IssueEvidence(
            name="Cache read tokens",
            value=_format_magnitude(stats.sum_cache_read_tokens),
            important=False,
        ),
        IssueEvidence(
            name="Cache write tokens",
            value=_format_magnitude(stats.sum_cache_creation_tokens),
            important=False,
        ),
        *_prompt_divergence_evidence(divergence),
    ]

    anchor = finding.anchor
    if anchor is not None:
        evidence_display.append(
            IssueEvidence(
                name="Healthy comparison",
                value=(
                    f"{anchor.model} reaches {_format_rate(anchor.hit_rate)} cache hit rate at "
                    f"{_format_call_site_label(anchor.agent_label, anchor.span_name)}"
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

    return evidence_display


def _build_event_data(
    project: Project,
    stats: CallSiteStats,
    sample_calls: list[SampleCall],
    event_id: str,
    detection_time: datetime,
) -> dict[str, Any]:
    event_data: dict[str, Any] = {
        "event_id": event_id,
        "project_id": project.id,
        # The occurrence consumer's event schema rejects a null platform.
        "platform": get_base_platform(project.platform) or "other",
        "timestamp": detection_time.isoformat(),
        "received": detection_time.isoformat(),
        # Tagged with the attribute the label came from, so filtering the issue
        # stream by it reaches the same spans the finding was derived from.
        "tags": {
            stats.agent_label_source.value: stats.agent_label,
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
    return event_data


@trace
def send_llm_cache_issue_to_platform(
    project: Project,
    finding: CacheFinding,
    sample_calls: list[SampleCall],
    window: DetectionWindow,
    savings: SavingsEstimate | None,
    divergence: PromptDivergence | None,
) -> None:
    """Produce an occurrence for a flagged call-site group."""
    stats = finding.stats
    now = datetime.now(UTC)
    event_id = uuid4().hex

    occurrence = IssueOccurrence(
        id=uuid4().hex,
        event_id=event_id,
        project_id=project.id,
        fingerprint=[create_fingerprint(stats)],
        issue_title=FINDING_TITLES[finding.outcome],
        subtitle=_format_call_site(stats),
        resource_id=None,
        evidence_data=_build_evidence_data(finding, sample_calls, window, savings, divergence),
        evidence_display=_build_evidence_display(finding, sample_calls, savings, divergence),
        type=LLMCacheUsageGroupType,
        detection_time=now,
        culprit=stats.agent_label,
        level="warning",
    )

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=_build_event_data(project, stats, sample_calls, event_id, now),
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
