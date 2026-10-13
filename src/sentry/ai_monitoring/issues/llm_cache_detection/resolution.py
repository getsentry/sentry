"""Resolve provisional LLM prompt-cache findings with focused probes."""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, replace
from functools import partial
from time import monotonic

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    CacheFinding,
    DetectionWindow,
    OutcomeReason,
    ProbeGap,
    resolve_with_cache_presence,
    resolve_with_warmth,
)
from sentry.ai_monitoring.issues.llm_cache_detection.query import (
    count_spans_with_cache_attributes,
    fetch_call_site_warmth,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.models.project import Project
from sentry.utils.snuba_rpc import SnubaRPCError

logger = logging.getLogger(__name__)


@dataclass
class ProbeBudget:
    limit: int
    sent: int = 0


def probe[T](
    project: Project,
    name: str,
    query: Callable[[], T | None],
    deadline: float,
    budget: ProbeBudget | None = None,
) -> T | ProbeGap:
    """Run a probe and preserve why it could not produce evidence."""
    if monotonic() >= deadline:
        return ProbeGap.OUT_OF_TIME
    if budget is not None and budget.sent >= budget.limit:
        return ProbeGap.BUDGET_EXHAUSTED
    try:
        answer = query()
    except (SnubaRPCError, InvalidSearchQuery) as error:
        if budget is not None:
            budget.sent += 1
        logger.warning(
            "llm_cache_issue_detection.probe_failed",
            extra={
                "project_id": project.id,
                "organization_id": project.organization_id,
                "probe": name,
                "error": type(error).__name__,
            },
            exc_info=True,
        )
        return ProbeGap.FAILED
    if answer is None:
        return ProbeGap.UNQUERYABLE
    if budget is not None:
        budget.sent += 1
    return answer


def resolve_candidate(
    project: Project,
    candidate: CacheFinding,
    window: DetectionWindow,
    deadline: float,
    warmth_budget: ProbeBudget,
) -> CacheFinding:
    """Validate reusable traffic, then disambiguate zero cache-token totals."""
    warmth = probe(
        project,
        "warmth",
        partial(fetch_call_site_warmth, project, candidate.stats, window),
        deadline,
        warmth_budget,
    )
    finding = replace(
        candidate,
        classification=resolve_with_warmth(candidate.classification, warmth),
        warmth=warmth,
    )
    if finding.classification.reason is not OutcomeReason.ZERO_CACHE_TOKENS:
        return finding

    presence = probe(
        project,
        "cache_presence",
        partial(count_spans_with_cache_attributes, project, finding.stats, window),
        deadline,
    )
    return replace(
        finding,
        classification=resolve_with_cache_presence(finding.classification, presence),
        spans_with_cache_attributes=presence,
    )
