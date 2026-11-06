from __future__ import annotations

import logging

from sentry.investigations.contracts import valid_linked_issues
from sentry.investigations.models import (
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
)
from sentry.issues.action_log import ActionSource, publish_action
from sentry.issues.action_log.types import InvestigationLinkedAction
from sentry.models.group import Group
from sentry.notebooks.access import issue_links_enabled
from sentry.notebooks.models import (
    Notebook,
    NotebookProject,
    NotebookSourceType,
    NotebookStatus,
)

logger = logging.getLogger(__name__)


def issue_link_idempotency_key(notebook_id: int) -> str:
    """One entry per investigation and group, however many runs link the group."""
    return f"investigation:{notebook_id}"


def _source_group_id(notebook: Notebook) -> int | None:
    """The group the investigation started from. Its own page already links the investigation."""
    if notebook.source_type != NotebookSourceType.METRIC_OPEN_PERIOD:
        return None
    ref = notebook.source.get("ref")
    group_id = ref.get("groupId") if isinstance(ref, dict) else None
    try:
        return int(group_id) if isinstance(group_id, int | str) else None
    except ValueError:
        return None


def link_investigation_issues(*, investigation_id: int, generation: int) -> None:
    """Record the issues a completed run linked on each issue's action log."""
    run = (
        InvestigationOrchestrationRun.objects.select_related("investigation__organization")
        .filter(investigation_id=investigation_id)
        .first()
    )
    # A newer generation schedules its own links once it completes.
    if (
        run is None
        or run.generation != generation
        or run.status != InvestigationOrchestrationStatus.COMPLETED
    ):
        return
    notebook = run.investigation
    if notebook.status == NotebookStatus.ARCHIVED or not issue_links_enabled(notebook.organization):
        return

    source_group_id = _source_group_id(notebook)
    linked = {
        item["groupId"]: item
        for item in valid_linked_issues(run.projection.get("linkedIssues"), log=True)
        if item["groupId"] != source_group_id
    }
    if not linked:
        return

    # Seer only reads the investigation's projects, so a group outside them isn't one it saw.
    groups = Group.objects.filter(
        id__in=linked,
        project__organization_id=notebook.organization_id,
        project_id__in=NotebookProject.objects.filter(notebook=notebook).values("project_id"),
    ).select_related("project")
    published = 0
    for group in groups:
        item = linked[group.id]
        publish_action(
            InvestigationLinkedAction(
                notebook_id=notebook.id,
                hypothesis_id=item["hypothesisId"],
                hypothesis_statement=item["hypothesisStatement"],
                reason=item["reason"],
            ),
            source=ActionSource.SEER_INVESTIGATION,
            group_id=group.id,
            project=group.project,
            idempotency_key=issue_link_idempotency_key(notebook.id),
        )
        published += 1

    logger.info(
        "investigations.issue_links.published",
        extra={
            "investigation_id": notebook.id,
            "generation": generation,
            "linked": len(linked),
            "published": published,
        },
    )
