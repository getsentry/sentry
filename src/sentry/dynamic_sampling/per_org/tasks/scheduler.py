from __future__ import annotations

from taskbroker_client.retry import Retry

from sentry.dynamic_sampling.per_org.tasks.gate import is_killswitch_engaged, is_rollout_enabled
from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    SCHEDULER_BEAT_STATUS_METRIC,
    TelemetryStatus,
    emit_status,
)
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.schedule_per_org_calculations",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=1 * 60,
    retry=Retry(times=0),
    silo_mode=SiloMode.CELL,
)
@dynamic_sampling_task
def schedule_per_org_calculations() -> None:
    if is_killswitch_engaged():
        emit_status(SCHEDULER_BEAT_STATUS_METRIC, TelemetryStatus.KILLSWITCHED)
        return
    if not is_rollout_enabled():
        emit_status(SCHEDULER_BEAT_STATUS_METRIC, TelemetryStatus.ROLLOUT_DISABLED)
        return
