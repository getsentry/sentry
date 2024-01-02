import logging
from collections import defaultdict
from typing import List, Sequence
from uuid import uuid4

import rest_framework
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstream
from sentry.api.base import audit_logger
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.groupinbox import GroupInbox
from sentry.models.project import Project
from sentry.signals import issue_deleted
from sentry.tasks.deletion.groups import delete_groups as delete_groups_task
from sentry.utils.audit import create_audit_entry

from . import BULK_MUTATION_LIMIT, SearchFunction
from .validators import ValidationError

delete_logger = logging.getLogger("sentry.deletions.api")


def delete_group_list(
    request: Request,
    project: "Project",
    group_list: List["Group"],
    delete_type: str,
) -> None:
    if not group_list:
        return

    # deterministic sort for sanity, and for very large deletions we'll
    # delete the "smaller" groups first
    group_list.sort(key=lambda g: (g.times_seen, g.id))
    group_ids = [g.id for g in group_list]

    Group.objects.filter(id__in=group_ids).exclude(
        status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]
    ).update(status=GroupStatus.PENDING_DELETION, substatus=None)

    eventstream_state = eventstream.backend.start_delete_groups(project.id, group_ids)
    transaction_id = uuid4().hex

    # We do not want to delete split hashes as they are necessary for keeping groups... split.
    GroupHash.objects.filter(
        project_id=project.id, group__id__in=group_ids, state=GroupHash.State.SPLIT
    ).update(group=None)
    GroupHash.objects.filter(project_id=project.id, group__id__in=group_ids).exclude(
        state=GroupHash.State.SPLIT
    ).delete()

    # We remove `GroupInbox` rows here so that they don't end up influencing queries for
    # `Group` instances that are pending deletion
    GroupInbox.objects.filter(project_id=project.id, group__id__in=group_ids).delete()

    delete_groups_task.apply_async(
        kwargs={
            "object_ids": group_ids,
            "transaction_id": transaction_id,
            "eventstream_state": eventstream_state,
        },
        countdown=3600,
    )

    for group in group_list:
        create_audit_entry(
            request=request,
            transaction_id=transaction_id,
            logger=audit_logger,
            organization_id=project.organization_id,
            target_object=group.id,
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
    projects: Sequence["Project"],
    organization_id: int,
    search_fn: SearchFunction,
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
    else:
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

    if any(group.issue_category != GroupCategory.ERROR for group in group_list):
        raise rest_framework.exceptions.ValidationError(detail="Only error issues can be deleted.")

    groups_by_project_id = defaultdict(list)
    for group in group_list:
        groups_by_project_id[group.project_id].append(group)

    for project in projects:
        delete_group_list(
            request, project, groups_by_project_id.get(project.id, []), delete_type="delete"
        )

    return Response(status=204)
