from django.utils import timezone

from sentry.models import Group, GroupSnooze, GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.signals import issue_unignored
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.clear_expired_snoozes", time_limit=65, soft_time_limit=60)
def clear_expired_snoozes():
    groupsnooze_list = list(
        GroupSnooze.objects.filter(until__lte=timezone.now()).values_list("id", "group")[:1000]
    )
    group_snooze_ids = [gs[0] for gs in groupsnooze_list]
    group_list = [gs[1] for gs in groupsnooze_list]

    ignored_groups = list(Group.objects.filter(id__in=group_list, status=GroupStatus.IGNORED))
    Group.objects.filter(id__in=group_list, status=GroupStatus.IGNORED).update(
        status=GroupStatus.UNRESOLVED
    )

    GroupSnooze.objects.filter(id__in=group_snooze_ids).delete()

    for group in ignored_groups:
        record_group_history(group, GroupHistoryStatus.UNIGNORED)
        issue_unignored.send_robust(
            project=group.project,
            user_id=None,
            group=group,
            transition_type="automatic",
            sender="clear_expired_snoozes",
        )
