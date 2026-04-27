"""Cron entry point for the per-org dynamic sampling pipeline."""

from __future__ import annotations

from taskbroker_client.retry import Retry

from sentry import options
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks

KILLSWITCH_OPTION = "dynamic-sampling.per_org.killswitch"
ROLLOUT_RATE_OPTION = "dynamic-sampling.per_org.rollout-rate"


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.schedule_per_org_calculations",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=1 * 60,
    retry=Retry(times=0),
    silo_mode=SiloMode.CELL,
)
@dynamic_sampling_task
def schedule_per_org_calculations() -> None:
    if options.get(KILLSWITCH_OPTION):
        return
    if options.get(ROLLOUT_RATE_OPTION) <= 0:
        return
