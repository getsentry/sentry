from __future__ import annotations

import logging
import textwrap
import time
from collections.abc import Sequence

import pydantic
import sentry_sdk

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.explorer.client_models import SeerRunState
from sentry.tasks.seer.night_shift.models import TriageAction, TriageResult
from sentry.tasks.seer.night_shift.simple_triage import (
    ScoredCandidate,
    fixability_score_strategy,
    priority_label,
)
from sentry.tasks.seer.night_shift.triage_tools import (
    get_event_details_agentic_triage,
    get_issue_details_agentic_triage,
)
from sentry.tasks.seer.night_shift.tweaks import (
    DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS,
    DEFAULT_INTELLIGENCE_LEVEL,
    DEFAULT_REASONING_EFFORT,
    IntelligenceLevel,
    ReasoningEffort,
)

logger = logging.getLogger("sentry.tasks.seer.night_shift")


class _TriageVerdict(pydantic.BaseModel):
    group_id: int
    action: TriageAction
    reason: str


class _TriageResponse(pydantic.BaseModel):
    verdicts: list[_TriageVerdict]


def agentic_triage_strategy(
    projects: Sequence[Project],
    organization: Organization,
    max_candidates: int,
    *,
    intelligence_level: IntelligenceLevel = DEFAULT_INTELLIGENCE_LEVEL,
    reasoning_effort: ReasoningEffort = DEFAULT_REASONING_EFFORT,
    extra_triage_instructions: str = DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS,
) -> tuple[list[TriageResult], int | None]:
    """
    Select candidates via fixability scoring, then use the Seer Explorer agent
    to investigate each candidate and decide the appropriate action.

    Returns a tuple of (triage_results, agent_run_id).
    """
    # TODO: try a new way to get scored issues
    scored = fixability_score_strategy(projects, max_candidates)
    if not scored:
        return [], None

    return _triage_candidates(
        scored,
        organization,
        intelligence_level=intelligence_level,
        reasoning_effort=reasoning_effort,
        extra_triage_instructions=extra_triage_instructions,
    )


def _triage_candidates(
    candidates: list[ScoredCandidate],
    organization: Organization,
    *,
    intelligence_level: IntelligenceLevel,
    reasoning_effort: ReasoningEffort,
    extra_triage_instructions: str,
) -> tuple[list[TriageResult], int | None]:
    """
    Start a Seer Explorer run to investigate candidate issues and return
    triage verdicts. The agent can browse the repo, inspect stacktraces,
    and use its tools to make informed decisions.

    Returns a tuple of (triage_results, agent_run_id).
    """
    groups_by_id = {c.group.id: c.group for c in candidates}

    try:
        client = SeerExplorerClient(
            organization,
            user=None,
            category_key="night_shift",
            category_value=f"org-{organization.id}",
            intelligence_level=intelligence_level,
            reasoning_effort=reasoning_effort,
            custom_tools=[
                get_event_details_agentic_triage,
                get_issue_details_agentic_triage,
            ],
        )

        agent_run_id = client.start_run(
            prompt=_build_triage_prompt(candidates, extra_triage_instructions),
            artifact_key="triage_verdicts",
            artifact_schema=_TriageResponse,
        )

        logger.info(
            "night_shift.explorer_run_started",
            extra={
                "organization_id": organization.id,
                "agent_run_id": agent_run_id,
                "num_candidates": len(candidates),
            },
        )

        state = _poll_with_logging(client, agent_run_id, organization.id)

        triage_response = state.get_artifact("triage_verdicts", _TriageResponse)
        if not triage_response:
            logger.error(
                "night_shift.triage_no_artifact",
                extra={
                    "organization_id": organization.id,
                    "agent_run_id": agent_run_id,
                    "status": state.status,
                },
            )
            sentry_sdk.metrics.count(
                "night_shift.triage_error",
                1,
                attributes={"error_type": "no_artifact"},
            )
            return [], agent_run_id
    except Exception:
        sentry_sdk.metrics.count(
            "night_shift.triage_error",
            1,
            attributes={"error_type": "explorer_error"},
        )
        logger.exception(
            "night_shift.triage_explorer_error",
            extra={"organization_id": organization.id},
        )
        raise

    logger.info(
        "night_shift.triage_verdicts",
        extra={
            "organization_id": organization.id,
            "agent_run_id": agent_run_id,
            "verdicts": {v.group_id: v.action for v in triage_response.verdicts},
        },
    )

    return [
        TriageResult(group=groups_by_id[v.group_id], action=v.action, reason=v.reason)
        for v in triage_response.verdicts
        if v.group_id in groups_by_id and v.action != TriageAction.SKIP
    ], agent_run_id


POLL_INTERVAL = 2.0


def _poll_with_logging(
    client: SeerExplorerClient,
    agent_run_id: int,
    organization_id: int,
) -> SeerRunState:
    """Poll an Explorer run, logging new non-loading blocks as they appear."""
    start_time = time.monotonic()
    seen_block_ids: set[str] = set()

    while True:
        state = client.get_run(agent_run_id)

        for block in state.blocks:
            if block.id in seen_block_ids or block.loading:
                continue
            seen_block_ids.add(block.id)

            msg = block.message
            tool_names = [tc.function for tc in msg.tool_calls] if msg.tool_calls else None
            logger.info(
                "night_shift.explorer_block",
                extra={
                    "organization_id": organization_id,
                    "agent_run_id": agent_run_id,
                    "block_id": block.id,
                    "role": msg.role,
                    "tool_calls": tool_names,
                    "has_artifacts": bool(block.artifacts),
                },
            )

        if state.status in ("completed", "error", "awaiting_user_input"):
            usage = state.usage
            logger.info(
                "night_shift.explorer_run_completed",
                extra={
                    "organization_id": organization_id,
                    "agent_run_id": agent_run_id,
                    "status": state.status,
                    "num_blocks": len(state.blocks),
                    "duration": round(time.monotonic() - start_time, 1),
                    "dollar_cost": usage.total_dollar_cost,
                    "usage": [
                        {
                            "model": u.model,
                            "prompt_tokens": u.prompt_tokens,
                            "completion_tokens": u.completion_tokens,
                            "cache_read_tokens": u.prompt_cache_read_tokens,
                            "cache_write_tokens": u.prompt_cache_write_tokens,
                            "thinking_tokens": u.thinking_tokens,
                            "total_tokens": u.total_tokens,
                        }
                        for u in usage.usages
                    ],
                },
            )
            return state

        time.sleep(POLL_INTERVAL)


def _build_triage_prompt(
    candidates: list[ScoredCandidate],
    extra_triage_instructions: str,
) -> str:
    candidates_block = "\n".join(
        f"- group_id={c.group.id} | title={c.group.title or 'Unknown error'!r} "
        f"| culprit={c.group.culprit or 'unknown'!r} "
        f"| fixability={c.fixability:.2f} | times_seen={c.times_seen} "
        f"| first_seen={c.group.first_seen.isoformat()} "
        f"| priority={priority_label(c.group.priority) or 'unknown'}"
        for c in candidates
    )

    extras_block = (
        f"\n\nAdditional instructions from project owners:\n{extra_triage_instructions}\n"
        if extra_triage_instructions
        else ""
    )

    return textwrap.dedent(f"""\
        You are a triage agent for Sentry's Night Shift system. Your job is to review
        a batch of candidate issues and decide which ones are worth running automated
        root-cause analysis and code fixes on.

        Use your tools to investigate each issue — look at all relevant telemetry: the stacktraces,
        event logs, event details, breadcrumbs, metrics, and the relevant code in the repository.

        When fetching event data for an issue, always use the `get_event_details_agentic_triage`
        tool instead of `get_event_details`. It returns the same data in a cleaner,
        more readable format tuned for triage.

        Similarly, when fetching issue-level metadata, always use the
        `get_issue_details_agentic_triage` tool instead of `get_issue_details`.
        It returns the header, tag distribution, and recent human activity in a
        compact markdown format. Do not rely on it for stacktraces — call
        `get_event_details_agentic_triage` for that.

        Before recording any verdict, you MUST read the relevant application code.
        Surface reading of the error message and stacktrace is not enough — many
        errors that look environmental (e.g. "file is not a database", "permission
        denied") are actually code bugs once you inspect how the failing code is
        called and what assumptions it makes about its inputs/environment.

        When evaluating each issue, consider whether an AI coding agent with full
        codebase access could fix the ROOT CAUSE of the issue — not just add try/except or defensive
        checks around it. Use these criteria:

        Clearly fixable in code (-> autofix):
        - The bug is a clear mistake in application logic (wrong key, off-by-one,
          missing None check on app data)
        - Root cause is visible in application code within a connected repository
        - Straightforward change to business logic

        Worth investigating but not auto-fixable (-> root_cause_only):
        - Likely fixable but requires non-trivial investigation or cross-cutting changes
        - Error originates in third-party libraries, vendor code, or framework internals
        - Root cause is outside the code (filesystem, external services, environment)

        Not worth processing (-> skip):
        - The issue is vague with no actionable stacktrace
        - Duplicate of another issue in this batch
        - The code is correct but the environment is broken (infra down, DNS failure,
          config not provisioned, data corruption)

        The "fixability" score in the candidate data is a prior estimate of how likely
        the issue is to be fixable (0.0 = not fixable, 1.0 = very fixable). Use it as
        a signal but verify with your own investigation.

        For each verdict, fill the `reason` field. For `autofix` and `root_cause_only`
        verdicts, the `reason` is handed off as context to the downstream autofix agent
        — write it like a debugging note to the next agent. Include the suspected file
        and function, the bug mechanism in one or two sentences, and a sketch of the
        fix direction so the next agent can resume your investigation instead of
        starting over. For `skip` verdicts, a brief justification is sufficient.

        Candidates:
        {candidates_block}{extras_block}
    """)
