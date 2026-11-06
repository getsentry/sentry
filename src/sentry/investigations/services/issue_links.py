from __future__ import annotations

import logging
from typing import Any

from django.db.models import QuerySet

from sentry.constants import ObjectStatus
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


def _linked_group(
    organization_id: int, item: dict[str, Any], project_ids: list[int]
) -> Group | None:
    """The linked issue, by group ID or by short ID, if it's in one of these projects."""
    if item.get("groupId") is not None:
        return (
            Group.objects.filter(id=item["groupId"], project_id__in=project_ids)
            .select_related("project")
            .first()
        )
    try:
        return Group.objects.by_qualified_short_id(
            organization_id, item["shortId"], project_ids=project_ids
        )
    except Group.DoesNotExist:
        return None


def link_investigation_issues(
    *, investigation_id: int, linked_issues: list[dict[str, Any]]
) -> None:
    """Record a completed run's linked issues on each issue's action log."""
    notebook = (
        Notebook.objects.select_related("organization")
        .filter(id=investigation_id, status=NotebookStatus.ACTIVE)
        .first()
    )
    if notebook is None or not issue_links_enabled(notebook.organization):
        return

    # Seer leaves out the issue the investigation started from, since it already links there.
    project_ids = list(_linkable_projects(notebook).values_list("id", flat=True))
    for item in linked_issues:
        group = _linked_group(notebook.organization_id, item, project_ids)
        if group is None:
            continue
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
        extra={"investigation_id": notebook.id, "linked": len(linked_issues)},
    )
