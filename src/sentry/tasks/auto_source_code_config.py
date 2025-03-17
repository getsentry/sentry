from __future__ import annotations

from typing import Any

from sentry.issues.auto_source_code_config.task import process_event
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.auto_source_code_config",
    queue="auto_source_code_config",
    default_retry_delay=60 * 10,
    max_retries=3,
)
def auto_source_code_config(project_id: int, event_id: str, group_id: int, **kwargs: Any) -> None:
    process_event(project_id, group_id, event_id)
