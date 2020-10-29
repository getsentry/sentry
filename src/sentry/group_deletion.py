from __future__ import absolute_import

from uuid import uuid4

from sentry import eventstream

from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.tasks.deletion import delete_groups


def delete_group(group):
    updated = (
        Group.objects.filter(id=group.id)
        .exclude(status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS])
        .update(status=GroupStatus.PENDING_DELETION)
    )

    if not updated:
        return

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

    return transaction_id
