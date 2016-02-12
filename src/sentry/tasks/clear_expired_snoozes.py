from __future__ import absolute_import, print_function

from django.utils import timezone

from sentry.models import Group, GroupSnooze, GroupStatus
from sentry.tasks.base import instrumented_task


@instrumented_task(name='sentry.tasks.clear_expired_snoozes',
                   time_limit=15,
                   soft_time_limit=10)
def clear_expired_snoozes():
    group_list = list(GroupSnooze.objects.filter(
        until__lte=timezone.now(),
    ).values_list('group', flat=True))

    Group.objects.filter(
        id__in=group_list,
        status=GroupStatus.MUTED,
    ).update(
        status=GroupStatus.UNRESOLVED,
    )

    GroupSnooze.objects.filter(
        group__in=group_list,
    ).delete()
