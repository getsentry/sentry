from typing import int
from django.utils import timezone

from sentry.models.rulesnooze import RuleSnooze
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks


@instrumented_task(
    name="sentry.tasks.clear_expired_rulesnoozes",
    namespace=issues_tasks,
    processing_deadline_duration=65,
    silo_mode=SiloMode.REGION,
)
def clear_expired_rulesnoozes() -> None:
    rule_snooze_ids = RuleSnooze.objects.filter(until__lte=timezone.now()).values_list("id")[:1000]
    RuleSnooze.objects.filter(id__in=rule_snooze_ids).delete()
