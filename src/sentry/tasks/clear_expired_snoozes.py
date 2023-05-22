from django.utils import timezone

from sentry import features
from sentry.issues.escalating import manage_issue_states
from sentry.models import Group, GroupInboxReason, GroupSnooze, GroupStatus
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

    GroupSnooze.objects.filter(id__in=group_snooze_ids).delete()

    for group in ignored_groups:
        if features.has("organizations:escalating-issues", group.organization):
            manage_issue_states(group, GroupInboxReason.ESCALATING)

        elif features.has("organizations:issue-states", group.organization):
            manage_issue_states(group, GroupInboxReason.ONGOING)

        else:
            manage_issue_states(group, GroupInboxReason.UNIGNORED)

        issue_unignored.send_robust(
            project=group.project,
            user_id=None,
            group=group,
            transition_type="automatic",
            sender="clear_expired_snoozes",
        )
