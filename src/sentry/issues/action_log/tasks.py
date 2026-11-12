from __future__ import annotations

from typing import Any

import sentry_sdk

from sentry.hybridcloud.tasks.deliver_from_outbox import (
    process_outbox_batch,
    schedule_outbox_model,
)
from sentry.issues.models.groupactionlogoutbox import GroupActionLogOutbox
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_action_log_tasks


@instrumented_task(
    name="sentry.issues.action_log.tasks.enqueue_group_action_log_outbox_jobs",
    namespace=issues_action_log_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=30,
)
def enqueue_group_action_log_outbox_jobs(concurrency: int | None = None, **kwargs: Any) -> None:
    try:
        schedule_outbox_model(
            silo_mode=SiloMode.CELL,
            outbox_model=GroupActionLogOutbox,
            drain_task=drain_group_action_log_outbox_shards,
            concurrency=concurrency,
        )
    except Exception:
        sentry_sdk.capture_exception()
        raise


@instrumented_task(
    name="sentry.issues.action_log.tasks.drain_group_action_log_outbox_shards",
    namespace=issues_action_log_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=90,
)
def drain_group_action_log_outbox_shards(
    outbox_identifier_low: int = 0,
    outbox_identifier_hi: int = 0,
) -> None:
    try:
        process_outbox_batch(
            outbox_identifier_hi=outbox_identifier_hi,
            outbox_identifier_low=outbox_identifier_low,
            outbox_model=GroupActionLogOutbox,
        )
    except Exception:
        sentry_sdk.capture_exception()
        raise
