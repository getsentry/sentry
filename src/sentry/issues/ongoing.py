from typing import Any, List, Mapping, Optional

from django.db.models.signals import post_save

from sentry.models import Group, GroupStatus, bulk_remove_groups_from_inbox
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


def bulk_transition_group_to_ongoing(
    from_status: GroupStatus,
    from_substatus: GroupSubStatus,
    groups: List[Group],
    activity_data: Optional[Mapping[str, Any]] = None,
) -> None:
    # make sure we don't update the Group when its already updated by conditionally updating the Group
    groups_to_transistion = Group.objects.filter(
        id__in=[group.id for group in groups], status=from_status, substatus=from_substatus
    )

    Group.objects.update_group_status(
        groups=groups_to_transistion,
        status=GroupStatus.UNRESOLVED,
        substatus=GroupSubStatus.ONGOING,
        activity_type=ActivityType.AUTO_SET_ONGOING,
        activity_data=activity_data,
        send_activity_notification=False,
    )

    for group in groups_to_transistion:
        group.status = GroupStatus.UNRESOLVED
        group.substatus = GroupSubStatus.ONGOING

    bulk_remove_groups_from_inbox(groups)

    for group in groups_to_transistion:
        post_save.send_robust(
            sender=Group,
            instance=group,
            created=False,
            update_fields=["status", "substatus"],
        )
