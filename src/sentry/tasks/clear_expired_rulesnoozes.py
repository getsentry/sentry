from django.utils import timezone

from sentry.models.rulesnooze import RuleSnooze
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.clear_expired_rulesnoozes",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
def clear_expired_rulesnoozes():
    rule_snooze_ids = RuleSnooze.objects.filter(until__lte=timezone.now()).values_list("id")[:1000]
    RuleSnooze.objects.filter(id__in=rule_snooze_ids).delete()
