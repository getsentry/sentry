from __future__ import annotations

import logging
import textwrap
from collections.abc import Sequence

import orjson
import pydantic

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.signed_seer_api import LlmGenerateRequest, make_llm_generate_request
from sentry.tasks.seer.night_shift.models import TriageAction, TriageResult
from sentry.tasks.seer.night_shift.simple_triage import (
    ScoredCandidate,
    fixability_score_strategy,
    priority_label,
)

logger = logging.getLogger("sentry.tasks.seer.night_shift")


class _TriageVerdict(pydantic.BaseModel):
    group_id: int
    action: TriageAction
    reason: str


class _TriageResponse(pydantic.BaseModel):
    verdicts: list[_TriageVerdict]

    @pydantic.validator("verdicts")
    def filter_skips(cls, v: list[_TriageVerdict]) -> list[_TriageVerdict]:
        return [verdict for verdict in v if verdict.action != TriageAction.SKIP]


def agentic_triage_strategy(
    projects: Sequence[Project],
    organization: Organization,
) -> list[TriageResult]:
    """
    Select candidates via fixability scoring, then filter through an LLM
    triage call that decides the action for each candidate.
    """
    scored = fixability_score_strategy(projects)
    if not scored:
        return []

    return _triage_candidates(scored, organization)


def _triage_candidates(
    candidates: list[ScoredCandidate],
    organization: Organization,
) -> list[TriageResult]:
    """
    Call Seer LLM proxy to triage the candidate batch via a single LLM call.
    Returns candidates the LLM didn't skip, with their assigned action.
    """
    groups_by_id = {c.group.id: c.group for c in candidates}

    body = LlmGenerateRequest(
        provider="gemini",
        model="pro-preview",
        referrer="night_shift.triage",
        prompt=_build_triage_prompt(candidates),
        system_prompt="",
        temperature=0.0,
        max_tokens=4096,
        response_schema=_TriageResponse.schema(),
    )

    try:
        response = make_llm_generate_request(body, timeout=60)
        if response.status >= 400:
            logger.error(
                "night_shift.triage_request_failed",
                extra={
                    "organization_id": organization.id,
                    "status": response.status,
                },
            )
            return []

        data = orjson.loads(response.data)
        content = data.get("content")
        if not content:
            logger.error(
                "night_shift.triage_empty_response",
                extra={"organization_id": organization.id},
            )
            return []

        triage_response = _TriageResponse.parse_raw(content)
    except Exception:
        logger.exception(
            "night_shift.triage_request_error",
            extra={"organization_id": organization.id},
        )
        return []

    results = [
        TriageResult(group=groups_by_id[v.group_id], action=v.action)
        for v in triage_response.verdicts
        if v.group_id in groups_by_id
    ]

    logger.info(
        "night_shift.triage_verdicts",
        extra={
            "organization_id": organization.id,
            "verdicts": {v.group_id: v.action for v in triage_response.verdicts},
        },
    )

    return results


def _build_triage_prompt(
    candidates: list[ScoredCandidate],
) -> str:
    candidates_block = "\n".join(
        f"- group_id={c.group.id} | title={c.group.title or 'Unknown error'!r} "
        f"| culprit={c.group.culprit or 'unknown'!r} "
        f"| fixability={c.fixability:.2f} | times_seen={c.times_seen} "
        f"| first_seen={c.group.first_seen.isoformat()} "
        f"| priority={priority_label(c.group.priority) or 'unknown'}"
        for c in candidates
    )

    return textwrap.dedent(f"""\
        You are a triage agent for Sentry's Night Shift system. Your job is to review
        a batch of candidate issues and decide which ones are worth running automated
        root-cause analysis and code fixes on.

        For each candidate, choose one action:
        - "autofix": Run the full automated pipeline (root cause → solution → code changes).
          Choose this for issues that look clearly fixable from their title/culprit and have
          a high fixability score.
        - "root_cause_only": Only run root-cause analysis, don't attempt a fix.
          Choose this for issues that are worth investigating but may be too complex or
          ambiguous to auto-fix confidently.
        - "skip": Don't process this issue.
          Choose this for issues that are vague, likely duplicates of each other in this
          batch, or not worth spending compute on.

        Provide a brief reason for each decision.

        Candidates:
        {candidates_block}
    """)
