from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from typing import Literal
from uuid import uuid4

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, eventstream
from sentry.api.base import audit_logger
from sentry.deletions.tasks.groups import delete_groups as delete_groups_task
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import GroupInbox
from sentry.models.project import Project
from sentry.signals import issue_deleted
from sentry.utils.audit import create_audit_entry

from . import BULK_MUTATION_LIMIT, SearchFunction
from .validators import ValidationError

delete_logger = logging.getLogger("sentry.deletions.api")


def delete_group_list(
    request: Request,
    project: Project,
    group_list: list[Group],
    delete_type: Literal["delete", "discard"],
) -> None:
    """Deletes a list of groups which belong to a single project.

    :param request: The request object.
    :param project: The project the groups belong to.
    :param group_list: The list of groups to delete.
    :param delete_type: The type of deletion to perform. This is used to determine the type of audit log to create.
    """
    if not group_list:
        return

    # deterministic sort for sanity, and for very large deletions we'll
    # delete the "smaller" groups first
    group_list.sort(key=lambda g: (g.times_seen, g.id))
    group_ids = [g.id for g in group_list]

    transaction_id = uuid4().hex
    delete_logger.info(
        "object.delete.api",
        extra={
            "objects": group_ids,
            "project_id": project.id,
            "transaction_id": transaction_id,
        },
    )
    # The tags can be used if we want to find errors for when a task fails
    sentry_sdk.set_tags(
        {
            "project_id": project.id,
            "transaction_id": transaction_id,
            "group_deletion_project_id": project.id,
            "group_deletion_group_ids": str(group_ids),
        },
    )

    Group.objects.filter(id__in=group_ids).exclude(
        status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]
    ).update(status=GroupStatus.PENDING_DELETION, substatus=None)

    eventstream_state = eventstream.backend.start_delete_groups(project.id, group_ids)

    # The moment groups are marked as pending deletion, we create audit entries
    # so that we can see who requested the deletion. Even if anything after this point
    # fails, we will still have a record of who requested the deletion.
    create_audit_entries(request, project, group_list, delete_type, transaction_id)

    # We remove `GroupInbox` rows here so that they don't end up influencing queries for
    # `Group` instances that are pending deletion
    GroupInbox.objects.filter(project_id=project.id, group__id__in=group_ids).delete()

    delete_groups_task.apply_async(
        kwargs={
            "object_ids": group_ids,
            "transaction_id": str(transaction_id),
            "eventstream_state": eventstream_state,
        }
    )


def create_audit_entries(
    request: Request,
    project: Project,
    group_list: Sequence[Group],
    delete_type: Literal["delete", "discard"],
    transaction_id: str,
) -> None:
    for group in group_list:
        create_audit_entry(
            request=request,
            transaction_id=transaction_id,
            logger=audit_logger,
            organization_id=project.organization_id,
            target_object=group.id,
            event=audit_log.get_event_id("ISSUE_DELETE"),
            data={
                "issue_id": group.id,
                "project_slug": project.slug,
            },
        )

        delete_logger.info(
            "object.delete.queued",
            extra={
                "object_id": group.id,
                "project_id": group.project_id,
                "transaction_id": transaction_id,
                "model": type(group).__name__,
            },
        )

        issue_deleted.send_robust(
            group=group, user=request.user, delete_type=delete_type, sender=delete_group_list
        )


def delete_groups(
    request: Request,
    projects: Sequence[Project],
    organization_id: int,
    search_fn: SearchFunction | None = None,
) -> Response:
    """
    `search_fn` refers to the `search.query` method with the appropriate
    project, org, environment, and search params already bound
    """
    group_ids = request.GET.getlist("id")
    if group_ids:
        group_list = list(
            Group.objects.filter(
                project__in=projects,
                project__organization_id=organization_id,
                id__in=set(group_ids),
            ).exclude(status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS])
        )
    elif search_fn:
        try:
            cursor_result, _ = search_fn(
                {
                    "limit": BULK_MUTATION_LIMIT,
                    "paginator_options": {"max_limit": BULK_MUTATION_LIMIT},
                }
            )
        except ValidationError as exc:
            return Response({"detail": str(exc)}, status=400)

        group_list = list(cursor_result)

    if not group_list:
        return Response(status=204)

    groups_by_project_id = defaultdict(list)
    for group in group_list:
        groups_by_project_id[group.project_id].append(group)

    for project in projects:
        delete_group_list(
            request, project, groups_by_project_id.get(project.id, []), delete_type="delete"
        )

    return Response(status=204)
