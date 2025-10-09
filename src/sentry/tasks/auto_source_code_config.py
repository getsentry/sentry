from __future__ import annotations

from typing import Any

from sentry.issues.auto_source_code_config.task import process_event
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.retry import Retry


@instrumented_task(
    name="sentry.tasks.auto_source_code_config",
    namespace=issues_tasks,
    # The auto source code configuration process can take longer for large projects
    # or when interacting with external services. Increase the processing deadline
    # from 5 minutes to 10 minutes to reduce the likelihood of premature task
    # termination in these scenarios.
    processing_deadline_duration=10 * 60,
    retry=Retry(times=3, delay=60 * 10),
)
def auto_source_code_config(project_id: int, event_id: str, group_id: int, **kwargs: Any) -> None:
    process_event(project_id, group_id, event_id)
