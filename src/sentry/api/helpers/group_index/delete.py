from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from typing import Literal
from uuid import uuid4

import rest_framework
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, eventstream, features
from sentry.api.base import audit_logger
from sentry.deletions.tasks.groups import delete_groups as delete_groups_task
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.groupinbox import GroupInbox
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.signals import issue_deleted
from sentry.tasks.delete_seer_grouping_records import call_delete_seer_grouping_records_by_hash
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

    issue_platform_deletion_allowed = features.has(
        "organizations:issue-platform-deletion", project.organization, actor=request.user
    )

    # deterministic sort for sanity, and for very large deletions we'll
    # delete the "smaller" groups first
    group_list.sort(key=lambda g: (g.times_seen, g.id))
    group_ids = []
    error_group_found = False
    for g in group_list:
        group_ids.append(g.id)
        if g.issue_category == GroupCategory.ERROR:
            error_group_found = True

    countdown = 3600
    # With ClickHouse light deletes we want to get rid of the long delay
    if issue_platform_deletion_allowed and not error_group_found:
        countdown = 0

    Group.objects.filter(id__in=group_ids).exclude(
        status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]
    ).update(status=GroupStatus.PENDING_DELETION, substatus=None)

    eventstream_state = eventstream.backend.start_delete_groups(project.id, group_ids)
    transaction_id = uuid4().hex

    # Tell seer to delete grouping records for these groups
    call_delete_seer_grouping_records_by_hash(group_ids)

    # Removing GroupHash rows prevents new events from associating to the groups
    # we just deleted.
    GroupHash.objects.filter(project_id=project.id, group__id__in=group_ids).delete()

    # We remove `GroupInbox` rows here so that they don't end up influencing queries for
    # `Group` instances that are pending deletion
    GroupInbox.objects.filter(project_id=project.id, group__id__in=group_ids).delete()

    delete_groups_task.apply_async(
        kwargs={
            "object_ids": group_ids,
            "transaction_id": transaction_id,
            "eventstream_state": eventstream_state,
        },
        countdown=countdown,
    )

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
                "organization_id": project.organization_id,
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

    org = Organization.objects.get_from_cache(id=organization_id)
    issue_platform_deletion_allowed = features.has(
        "organizations:issue-platform-deletion", org, actor=request.user
    )
    non_error_group_found = any(group.issue_category != GroupCategory.ERROR for group in group_list)
    if not issue_platform_deletion_allowed and non_error_group_found:
        raise rest_framework.exceptions.ValidationError(detail="Only error issues can be deleted.")

    groups_by_project_id = defaultdict(list)
    for group in group_list:
        groups_by_project_id[group.project_id].append(group)

    for project in projects:
        delete_group_list(
            request, project, groups_by_project_id.get(project.id, []), delete_type="delete"
        )

    return Response(status=204)
