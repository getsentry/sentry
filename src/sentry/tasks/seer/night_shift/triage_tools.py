from __future__ import annotations

from django.core.exceptions import BadRequest
from pydantic import BaseModel, Field

from sentry.integrations.models.repository_project_path_config import (
    RepositoryProjectPathConfig,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.agent.custom_tool_utils import AgentTool
from sentry.seer.agent.tools import get_event_details, get_issue_details
from sentry.tasks.seer.night_shift.event_formatter import format_event_output
from sentry.tasks.seer.night_shift.issue_formatter import format_issue_output


class GetEventDetailsAgenticTriageParams(BaseModel):
    event_id: str | None = Field(
        default=None,
        description="The UUID of the event (mutually exclusive with issue_id).",
    )
    issue_id: str | None = Field(
        default=None,
        description=(
            "The issue ID (numeric) or qualified short ID (mutually exclusive with event_id)."
        ),
    )
    start: str | None = Field(
        default=None,
        description=(
            "ISO timestamp for the start of the time range to get a recommended "
            "event for. Must be provided together with end."
        ),
    )
    end: str | None = Field(
        default=None,
        description=(
            "ISO timestamp for the end of the time range. Must be provided together with start."
        ),
    )
    project_slug: str | None = Field(
        default=None,
        description="The slug of the project (optional).",
    )


# Class name intentionally snake_case — the agent custom-tool machinery
# uses `__name__` as the tool name the agent sees, and we want this to read
# like a tool identifier (`get_event_details_agentic_triage`).
class get_event_details_agentic_triage(  # noqa: N801
    AgentTool[GetEventDetailsAgenticTriageParams]
):
    """Custom agent tool for Night Shift agentic triage.

    Returns the same underlying event data as Seer's built-in `get_event_details`,
    but renders it in the markdown format used by sentry-mcp (`formatEventOutput`)
    instead of Seer's `<event>...</event>` text block. Optimized for LLM
    consumption during triage: drops the per-frame SUSPECT LINE markers, caps
    variable values at ~80 chars, and only shows enhanced context + locals on
    the first in-app frame.
    """

    params_model = GetEventDetailsAgenticTriageParams

    @classmethod
    def get_description(cls) -> str:
        return (
            "Fetch details for a sample event or occurrence of a Sentry issue, "
            "or look up a specific event by its UUID. Returns markdown-formatted "
            "event data: stack trace with inline code context, local variables "
            "on the most relevant frame, tags, contexts, HTTP request, and user.\n\n"
            "Supports two modes:\n"
            "- Query by issue_id to get a recommended sample event for that issue. "
            "Optionally provide start/end to sample from a specific time range.\n"
            "- Query by event_id (32-character UUID) to fetch a specific event directly."
        )

    @classmethod
    def execute(
        cls,
        organization: Organization,
        params: GetEventDetailsAgenticTriageParams,
    ) -> str:
        try:
            result = get_event_details(
                organization_id=organization.id,
                event_id=params.event_id,
                issue_id=params.issue_id,
                start=params.start,
                end=params.end,
                project_slug=params.project_slug,
            )
        except (BadRequest, Group.DoesNotExist, ValueError) as e:
            # All three are agent-correctable: bad arg combo, missing group, or
            # malformed UUID. Return the exception message so the agent can see
            # what went wrong and retry. Unexpected errors (Organization.DoesNotExist,
            # AssertionError, etc.) bubble up to be logged as real failures.
            return f"Could not fetch event: {e}"
        if result is None:
            return "Event not found. Check the issue_id/event_id and time range."

        event = result.get("event") or {}
        body = format_event_output(event)
        return (
            f"Event ID: {result.get('event_id')}\n"
            f"Trace ID: {result.get('event_trace_id') or 'N/A'}\n"
            f"Issue ID: {event.get('groupID') or 'N/A'}\n"
            f"Project ID: {result.get('project_id')}\n"
            f"Project Slug: {result.get('project_slug')}\n"
            f"\n{body}"
        )


class GetIssueDetailsAgenticTriageParams(BaseModel):
    issue_id: str = Field(
        description="The issue ID (numeric) or qualified short ID (e.g. PROJECT-123).",
    )
    start: str | None = Field(
        default=None,
        description=(
            "ISO timestamp for the start of the time range. Must be provided together with end."
        ),
    )
    end: str | None = Field(
        default=None,
        description=(
            "ISO timestamp for the end of the time range. Must be provided together with start."
        ),
    )
    project_slug: str | None = Field(
        default=None,
        description="The slug of the project (optional).",
    )


# Class name intentionally snake_case — see comment on `get_event_details_agentic_triage`.
class get_issue_details_agentic_triage(  # noqa: N801
    AgentTool[GetIssueDetailsAgenticTriageParams]
):
    """Custom agent tool for Night Shift agentic triage.

    Returns the same underlying issue metadata as Seer's built-in `get_issue_details`,
    but reformats it as triage-tuned markdown: header (title/culprit/priority/counts/
    first-last seen), linked repos, aggregated tag distribution, and recent human
    activity. The latest-event stacktrace excerpt is intentionally omitted so the
    agent is steered toward `get_event_details_agentic_triage` for stack inspection.
    """

    params_model = GetIssueDetailsAgenticTriageParams

    @classmethod
    def get_description(cls) -> str:
        return (
            "Fetch issue-level metadata for a Sentry issue: title, culprit, "
            "level/priority/status, first/last seen, event and user counts, "
            "assignee, linked repositories (repo name + source/stack roots), "
            "aggregated tag distribution across all events, and recent human "
            "activity (notes, assignments, resolutions).\n\n"
            "Use this to decide whether an issue is worth investigating. For "
            "the actual stacktrace and failing code context, call "
            "`get_event_details_agentic_triage` separately."
        )

    @classmethod
    def execute(
        cls,
        organization: Organization,
        params: GetIssueDetailsAgenticTriageParams,
    ) -> str:
        try:
            result = get_issue_details(
                organization_id=organization.id,
                issue_id=params.issue_id,
                start=params.start,
                end=params.end,
                project_slug=params.project_slug,
            )
        except (BadRequest, Group.DoesNotExist, ValueError) as e:
            return f"Could not fetch issue: {e}"
        if result is None:
            return "Issue not found. Check the issue_id and time range."

        project_id = result.get("project_id")
        linked_repos = _format_linked_repos(project_id) if project_id else ""
        body = format_issue_output(result)
        return (
            f"Issue ID: {params.issue_id}\n"
            f"Project ID: {project_id}\n"
            f"Project Slug: {result.get('project_slug')}\n"
            f"{linked_repos}"
            f"\n{body}"
        )


def _format_linked_repos(project_id: int) -> str:
    """Render the project's linked GitHub repos + source-root mappings.

    Surfaces the actual repo name (e.g. `getsentry/seer-test-sandbox`) so the
    agent doesn't have to guess it from the project slug. Includes source_root
    because many repos place app code under a subdirectory (e.g. `python/`).
    """
    configs = (
        RepositoryProjectPathConfig.objects.filter(project_id=project_id)
        .select_related("repository")
        .order_by("id")
    )
    lines: list[str] = []
    for cfg in configs:
        repo_name = cfg.repository.name
        source_root = cfg.source_root or ""
        stack_root = cfg.stack_root or ""
        parts = [f"- {repo_name}"]
        if source_root:
            parts.append(f"source_root={source_root!r}")
        if stack_root:
            parts.append(f"stack_root={stack_root!r}")
        lines.append(
            " ".join(parts) if len(parts) == 1 else parts[0] + " (" + ", ".join(parts[1:]) + ")"
        )

    if not lines:
        return ""
    return "Linked Repos:\n" + "\n".join(lines) + "\n"
