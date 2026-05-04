from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from pydantic import BaseModel, Field

from sentry.constants import ObjectStatus
from sentry.issues.grouptype import FeedbackGroup
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.custom_tool_utils import AgentTool

# Hard cap on rows returned per call so the agent doesn't accidentally pull
# the full feedback corpus into a single tool response.
MAX_FEEDBACK_LIST_LIMIT = 200
DEFAULT_FEEDBACK_LIST_LIMIT = 50

# How far back the agent is allowed to look. Aligned with the daily cron
# cadence — we summarize "the last day" of feedback, with a small grace window.
FEEDBACK_LOOKBACK = timedelta(days=2)


class GetFeedbackListSummaryParams(BaseModel):
    project_ids: list[int] | None = Field(
        default=None,
        description=(
            "Optional list of project IDs to filter by. When omitted, returns "
            "feedback from every project in the organization."
        ),
    )
    limit: int = Field(
        default=DEFAULT_FEEDBACK_LIST_LIMIT,
        description=(
            "Maximum number of feedback entries to return, ordered by most "
            f"recent first_seen. Capped at {MAX_FEEDBACK_LIST_LIMIT}."
        ),
    )


# Class name intentionally snake_case — see the comment on
# `get_event_details_agentic_triage` in triage_tools.py.
class get_feedback_list_summary_tool(  # noqa: N801
    AgentTool[GetFeedbackListSummaryParams]
):
    """Custom agent tool for Night Shift feedback summarization.

    Returns the most recent unresolved user feedback messages for the org
    (last ~24 hours), optionally filtered to specific projects. Each row
    includes the message body, project info, and first_seen so the agent
    can group, theme, and summarize.
    """

    params_model = GetFeedbackListSummaryParams

    @classmethod
    def get_description(cls) -> str:
        return (
            "Fetch a batch of recent user feedback entries for this organization. "
            "Returns markdown-formatted rows with feedback id, message body, "
            "project, and timestamp. Use this to enumerate the day's feedback "
            "and identify themes. Filter by project_ids when an org has many "
            "projects and you only need a subset."
        )

    @classmethod
    def execute(
        cls,
        organization: Organization,
        params: GetFeedbackListSummaryParams,
    ) -> str:
        limit = max(1, min(params.limit, MAX_FEEDBACK_LIST_LIMIT))
        projects = _resolve_org_projects(organization, params.project_ids)
        if not projects:
            return "No projects matched the filter."

        groups = (
            Group.objects.filter(
                type=FeedbackGroup.type_id,
                status=GroupStatus.UNRESOLVED,
                project__in=projects,
                first_seen__gte=timezone.now() - FEEDBACK_LOOKBACK,
            )
            .select_related("project")
            .order_by("-first_seen")[:limit]
        )

        rendered = [_render_feedback_row(g) for g in groups]
        if not rendered:
            return "No feedback found in the lookback window."
        return f"Found {len(rendered)} feedback entries:\n\n" + "\n\n".join(rendered)


class GetFeedbackDetailsSummaryParams(BaseModel):
    feedback_group_id: int = Field(
        description=(
            "The Group ID of the feedback entry to fetch. Must match an id "
            "returned by `get_feedback_list_summary_tool`."
        ),
    )


# Class name intentionally snake_case — see the comment above.
class get_feedback_details_summary_tool(  # noqa: N801
    AgentTool[GetFeedbackDetailsSummaryParams]
):
    """Custom agent tool for Night Shift feedback summarization.

    Returns the full feedback message and metadata for a single feedback group.
    Always scoped to the calling organization; cross-org IDs return an error
    message rather than leaking data.
    """

    params_model = GetFeedbackDetailsSummaryParams

    @classmethod
    def get_description(cls) -> str:
        return (
            "Fetch the full message body and metadata for a single feedback "
            "entry. Returns a markdown block with the message, project, "
            "timestamps, and any contact info attached to the feedback."
        )

    @classmethod
    def execute(
        cls,
        organization: Organization,
        params: GetFeedbackDetailsSummaryParams,
    ) -> str:
        group = (
            Group.objects.filter(
                id=params.feedback_group_id,
                project__organization_id=organization.id,
                type=FeedbackGroup.type_id,
            )
            .select_related("project")
            .first()
        )
        if group is None:
            return (
                "Feedback not found. Check the feedback_group_id and confirm it "
                "belongs to this organization."
            )
        return _render_feedback_row(group, include_full_metadata=True)


def _resolve_org_projects(
    organization: Organization, project_ids: list[int] | None
) -> list[Project]:
    qs = Project.objects.filter(organization_id=organization.id, status=ObjectStatus.ACTIVE)
    if project_ids is not None:
        qs = qs.filter(id__in=project_ids)
    return list(qs)


def _render_feedback_row(group: Group, *, include_full_metadata: bool = False) -> str:
    metadata = (group.data or {}).get("metadata") or {}
    message = metadata.get("message") or "(empty)"
    lines = [
        f"- feedback_group_id={group.id}",
        f"  project={group.project.slug} ({group.project.id})",
        f"  first_seen={group.first_seen.isoformat()}",
        f"  times_seen={group.times_seen}",
    ]
    if include_full_metadata:
        contact = metadata.get("contact_email") or metadata.get("name")
        if contact:
            lines.append(f"  contact={contact!r}")
        lines.append("  message:")
        lines.append("  ```")
        lines.append(_indent_block(message, "  "))
        lines.append("  ```")
    else:
        lines.append(f"  message={message[:500]!r}")
    return "\n".join(lines)


def _indent_block(text: str, prefix: str) -> str:
    return "\n".join(f"{prefix}{line}" for line in text.splitlines() or [""])
