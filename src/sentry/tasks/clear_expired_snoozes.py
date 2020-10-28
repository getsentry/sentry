from __future__ import absolute_import, print_function

from django.utils import timezone

from sentry.signals import issue_unignored
from sentry.models import Group, GroupSnooze, GroupStatus
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.clear_expired_snoozes", time_limit=65, soft_time_limit=60)
def clear_expired_snoozes():
    group_list = list(
        GroupSnooze.objects.filter(until__lte=timezone.now()).values_list("group", flat=True)
    )

    ignored_groups = list(Group.objects.filter(id__in=group_list, status=GroupStatus.IGNORED))
    Group.objects.filter(id__in=group_list, status=GroupStatus.IGNORED).update(
        status=GroupStatus.UNRESOLVED
    )

    GroupSnooze.objects.filter(group__in=group_list).delete()

    for group in ignored_groups:
        issue_unignored.send_robust(
            project=group.project,
            user=None,
            group=group,
            transition_type="automatic",
            sender="clear_expired_snoozes",
        )
