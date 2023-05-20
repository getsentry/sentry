from django.db.models.signals import post_save

from sentry.models import (
    Activity,
    Group,
    GroupInboxReason,
    GroupStatus,
    add_group_to_inbox,
    record_group_history_from_activity_type,
    remove_group_from_inbox,
)
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


def transition_group_to_ongoing(
    from_status: GroupStatus, from_substatus: GroupSubStatus, group: Group
) -> None:
    # make sure we don't update the Group when its already updated by conditionally updating the Group
    updated = Group.objects.filter(
        id=group.id, status=from_status, substatus=from_substatus
    ).update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
    if updated:
        group.status = GroupStatus.UNRESOLVED
        group.substatus = GroupSubStatus.ONGOING
        post_save.send_robust(
            sender=Group,
            instance=group,
            created=False,
            update_fields=["status", "substatus"],
        )

        remove_group_from_inbox(group)

        add_group_to_inbox(group, GroupInboxReason.ONGOING)

        Activity.objects.create_group_activity(
            group, ActivityType.AUTO_SET_ONGOING, send_notification=False
        )

        record_group_history_from_activity_type(
            group, activity_type=ActivityType.AUTO_SET_ONGOING.value, actor=None
        )
