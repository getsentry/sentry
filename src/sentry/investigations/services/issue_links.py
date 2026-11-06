from __future__ import annotations

import logging

from django.db.models import QuerySet

from sentry.constants import ObjectStatus
from sentry.investigations.models import (
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
)
from sentry.investigations.services.actor_access import actor_can_investigate
from sentry.issues.action_log import ActionSource, publish_action
from sentry.issues.action_log.types import InvestigationLinkedAction
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.notebooks.access import issue_links_enabled
from sentry.notebooks.models import Notebook, NotebookStatus

logger = logging.getLogger(__name__)


def issue_link_idempotency_key(notebook_id: int) -> str:
    """One entry per investigation and group, however many runs link the group."""
    return f"investigation:{notebook_id}"


def _linkable_projects(notebook: Notebook) -> QuerySet[Project]:
    """The active projects the investigation covers, while its creator can still investigate.

    No selected projects means the whole organization, the same as when it was created.
    """
    selected = list(notebook.projects.values_list("id", flat=True))
    projects = Project.objects.filter(
        organization_id=notebook.organization_id, status=ObjectStatus.ACTIVE
    )
    if not actor_can_investigate(
        organization=notebook.organization, actor=notebook.creator_actor, project_ids=selected
    ):
        return projects.none()
    if selected:
        return projects.filter(id__in=selected)
    return projects


def link_investigation_issues(*, investigation_id: int, generation: int) -> None:
    """Record the issues a completed run linked on each issue's action log."""
    run = (
        InvestigationOrchestrationRun.objects.select_related("investigation__organization")
        .filter(
            investigation_id=investigation_id,
            # A newer generation schedules its own links once it completes.
            generation=generation,
            status=InvestigationOrchestrationStatus.COMPLETED,
            investigation__status=NotebookStatus.ACTIVE,
        )
        .first()
    )
    if run is None or not issue_links_enabled(run.investigation.organization):
        return
    notebook = run.investigation

    # Seer leaves out the issue the investigation started from, since it already links there.
    linked = {item["groupId"]: item for item in run.projection.get("linkedIssues", [])}
    groups = Group.objects.filter(
        id__in=linked, project__in=_linkable_projects(notebook)
    ).select_related("project")
    for group in groups:
        item = linked[group.id]
        publish_action(
            InvestigationLinkedAction(
                notebook_id=notebook.id,
                hypothesis_id=item["hypothesisId"],
                hypothesis_statement=item["hypothesisStatement"],
                reason=item.get("reason"),
            ),
            source=ActionSource.SEER_INVESTIGATION,
            group_id=group.id,
            project=group.project,
            idempotency_key=issue_link_idempotency_key(notebook.id),
        )

    logger.info(
        "investigations.issue_links.published",
        extra={"investigation_id": notebook.id, "generation": generation, "linked": len(linked)},
    )
