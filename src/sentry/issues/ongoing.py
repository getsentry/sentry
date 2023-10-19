from typing import Any, List, Mapping, Optional

import sentry_sdk
from django.db.models.signals import post_save

from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import bulk_remove_groups_from_inbox
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


def bulk_transition_group_to_ongoing(
    from_status: int,
    from_substatus: int,
    group_ids: List[int],
    activity_data: Optional[Mapping[str, Any]] = None,
) -> None:
    with sentry_sdk.start_span(description="groups_to_transistion") as span:
        # make sure we don't update the Group when its already updated by conditionally updating the Group
        groups_to_transistion = Group.objects.filter(
            id__in=group_ids, status=from_status, substatus=from_substatus
        )
        span.set_tag("group_ids", group_ids)
        span.set_tag("groups_to_transistion count", len(groups_to_transistion))

    with sentry_sdk.start_span(description="update_group_status"):
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

    with sentry_sdk.start_span(description="bulk_remove_groups_from_inbox"):
        bulk_remove_groups_from_inbox(groups_to_transistion)

    with sentry_sdk.start_span(description="post_save_send_robust"):
        for group in groups_to_transistion:
            post_save.send_robust(
                sender=Group,
                instance=group,
                created=False,
                update_fields=["status", "substatus"],
            )
