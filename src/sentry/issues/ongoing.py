from sentry.models import (
    Activity,
    Group,
    GroupInbox,
    GroupInboxReason,
    GroupStatus,
    add_group_to_inbox,
    record_group_history_from_activity_type,
    remove_group_from_inbox,
)
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


def transition_new_to_ongoing(group: Group, group_inbox: GroupInbox) -> None:
    if group.status == GroupStatus.UNRESOLVED and group.substatus == GroupSubStatus.NEW:
        group.substatus = GroupSubStatus.ONGOING
        group.save(update_fields=["substatus"])

        remove_group_from_inbox(group)

        add_group_to_inbox(group, GroupInboxReason.ONGOING)

        Activity.objects.create_group_activity(group, ActivityType.ONGOING, send_notification=False)

        record_group_history_from_activity_type(
            group, activity_type=ActivityType.ONGOING.value, actor=None
        )
