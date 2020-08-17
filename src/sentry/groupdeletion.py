from __future__ import absolute_import

from uuid import uuid4
import logging

from sentry import eventstream
from sentry.utils.audit import create_audit_entry
from sentry.models import (
    Group,
    GroupHash,
    GroupStatus,
)
from sentry.utils import metrics
from sentry.signals import issue_deleted

delete_logger = logging.getLogger("sentry.deletions.api")
audit_logger = logging.getLogger("sentry.audit.api")


def delete_group(group, request=None):
    from sentry.tasks.deletion import delete_groups

    updated = (
        Group.objects.filter(id=group.id)
        .exclude(status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS])
        .update(status=GroupStatus.PENDING_DELETION)
    )
    if updated:
        project = group.project

        eventstream_state = eventstream.start_delete_groups(group.project_id, [group.id])
        transaction_id = uuid4().hex

        GroupHash.objects.filter(project_id=group.project_id, group__id=group.id).delete()

        delete_groups.apply_async(
            kwargs={
                "object_ids": [group.id],
                "transaction_id": transaction_id,
                "eventstream_state": eventstream_state,
            },
            countdown=3600,
        )

        if request is not None:
            create_audit_entry(
                request=request,
                organization_id=project.organization_id if project else None,
                target_object=group.id,
                transaction_id=transaction_id,
                audit_logger=audit_logger,
            )

        delete_logger.info(
            "object.delete.queued",
            extra={
                "object_id": group.id,
                "transaction_id": transaction_id,
                "model": type(group).__name__,
            },
        )

        issue_deleted.send_robust(
            group=group,
            user=request and request.user or None,
            delete_type="delete",
            sender=delete_group,
        )

    metrics.incr("group.update.http_response", sample_rate=1.0, tags={"status": 200})
