from __future__ import annotations

import logging
import textwrap
from datetime import timedelta

import pydantic
import sentry_sdk
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.issues.grouptype import FeedbackGroup
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models.night_shift import (
    NightShiftRunResultKind,
    SeerNightShiftRun,
    SeerNightShiftRunResult,
)
from sentry.tasks.seer.night_shift.agentic_triage import _poll_with_logging
from sentry.tasks.seer.night_shift.feedback_summary_tools import (
    get_feedback_details_summary_tool,
    get_feedback_list_summary_tool,
)
from sentry.tasks.seer.night_shift.tweaks import (
    DEFAULT_INTELLIGENCE_LEVEL,
    DEFAULT_REASONING_EFFORT,
    IntelligenceLevel,
    ReasoningEffort,
)

logger = logging.getLogger("sentry.tasks.seer.night_shift")

MIN_FEEDBACKS_TO_SUMMARIZE = 10
SUMMARY_LOOKBACK = timedelta(days=1)


class _FeedbackTheme(pydantic.BaseModel):
    title: str
    description: str
    feedback_group_ids: list[int] = pydantic.Field(default_factory=list)


class _FeedbackSummaryArtifact(pydantic.BaseModel):
    summary: str
    themes: list[_FeedbackTheme] = pydantic.Field(default_factory=list)
    num_feedbacks_analyzed: int


def agentic_feedback_summary_strategy(
    organization: Organization,
    *,
    run: SeerNightShiftRun,
    intelligence_level: IntelligenceLevel = DEFAULT_INTELLIGENCE_LEVEL,
    reasoning_effort: ReasoningEffort = DEFAULT_REASONING_EFFORT,
) -> int | None:
    """Summarize the org's user feedback from the last day via the Seer agent.

    Writes a single SeerNightShiftRunResult row (kind="feedback_summary")
    containing the summary, themes, and counts. Returns the agent_run_id, or
    None if the run was skipped (insufficient feedback) or errored.
    """
    feedback_group_ids = _recent_feedback_group_ids(organization)
    if len(feedback_group_ids) < MIN_FEEDBACKS_TO_SUMMARIZE:
        logger.info(
            "night_shift.feedback_summary.skipped_insufficient",
            extra={
                "organization_id": organization.id,
                "num_feedbacks": len(feedback_group_ids),
                "min_required": MIN_FEEDBACKS_TO_SUMMARIZE,
            },
        )
        return None

    try:
        client = SeerAgentClient(
            organization,
            user=None,
            category_key="night_shift_feedback_summary",
            category_value=f"org-{organization.id}",
            intelligence_level=intelligence_level,
            reasoning_effort=reasoning_effort,
            custom_tools=[
                get_feedback_list_summary_tool,
                get_feedback_details_summary_tool,
            ],
        )

        agent_run_id = client.start_run(
            prompt=_build_summary_prompt(len(feedback_group_ids)),
            artifact_key="feedback_summary",
            artifact_schema=_FeedbackSummaryArtifact,
        )

        logger.info(
            "night_shift.feedback_summary.run_started",
            extra={
                "organization_id": organization.id,
                "agent_run_id": agent_run_id,
                "num_feedback_group_ids": len(feedback_group_ids),
            },
        )

        state = _poll_with_logging(client, agent_run_id, organization.id)

        artifact = state.get_artifact("feedback_summary", _FeedbackSummaryArtifact)
        if artifact is None:
            logger.error(
                "night_shift.feedback_summary.no_artifact",
                extra={
                    "organization_id": organization.id,
                    "agent_run_id": agent_run_id,
                    "status": state.status,
                },
            )
            sentry_sdk.metrics.count(
                "night_shift.feedback_summary_error",
                1,
                attributes={"error_type": "no_artifact"},
            )
            return agent_run_id
    except Exception:
        sentry_sdk.metrics.count(
            "night_shift.feedback_summary_error",
            1,
            attributes={"error_type": "explorer_error"},
        )
        logger.exception(
            "night_shift.feedback_summary.explorer_error",
            extra={"organization_id": organization.id},
        )
        raise

    SeerNightShiftRunResult.objects.create(
        run=run,
        kind=NightShiftRunResultKind.FEEDBACK_SUMMARY,
        group=None,
        seer_run_id=str(agent_run_id),
        extras={
            **artifact.dict(),
            "feedback_group_ids_sampled": feedback_group_ids,
            "agent_run_id": agent_run_id,
        },
    )

    sentry_sdk.metrics.count(
        "night_shift.feedback_summary_recorded",
        1,
        attributes={"num_themes": str(len(artifact.themes))},
    )
    return agent_run_id


def _recent_feedback_group_ids(organization: Organization) -> list[int]:
    """Bound the candidate set the agent can pull from. The agent's tools also
    re-filter on the same window so it never sees rows older than this."""
    project_ids = list(
        organization.project_set.filter(status=ObjectStatus.ACTIVE).values_list("id", flat=True)
    )
    if not project_ids:
        return []
    cutoff = timezone.now() - SUMMARY_LOOKBACK
    return list(
        Group.objects.filter(
            type=FeedbackGroup.type_id,
            status=GroupStatus.UNRESOLVED,
            project_id__in=project_ids,
            first_seen__gte=cutoff,
        )
        .order_by("-first_seen")
        .values_list("id", flat=True)
    )


def _build_summary_prompt(num_feedbacks: int) -> str:
    return textwrap.dedent(f"""\
        You are a feedback summarization agent for Sentry's Night Shift system.
        This organization received {num_feedbacks} pieces of user feedback in the
        last 24 hours. Your job is to read through them and produce a structured
        summary an engineering team can act on.

        Use `get_feedback_list_summary_tool` to enumerate feedback. Call it once
        with no project filter to see the spread, then optionally narrow by
        project_ids if a single product surface dominates. Use
        `get_feedback_details_summary_tool` only when you need the full message
        body for a specific feedback that the list view truncated.

        Produce a `feedback_summary` artifact with:
        - `summary`: 3-6 sentences describing the day's feedback at a glance.
          Lead with what changed vs. the usual baseline (if you can tell), then
          call out the most important themes by frequency or severity.
        - `themes`: a list of distinct, named themes. For each theme include
          a short title, a 1-2 sentence description, and the
          `feedback_group_ids` that exemplify it. Aim for 3-8 themes; merge
          near-duplicates aggressively.
        - `num_feedbacks_analyzed`: count of feedback entries you actually
          read while building this summary.

        Stay grounded in what the feedback actually says — do not speculate
        about features users didn't mention. If the day's feedback is mostly
        noise, say so concisely rather than padding with weak themes.
    """)
