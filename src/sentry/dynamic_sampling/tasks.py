import logging

from sentry.tasks.base import instrumented_task

CHUNK_SIZE = 1000
MAX_SECONDS = 60

logger = logging.getLogger("sentry.tasks.dynamic_sampling")


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.foo",
    queue="releasemonitor",
    default_retry_delay=5,
    max_retries=5,
)  # type: ignore
def foo(**kwargs) -> None:
    for org_id, project_ids in fetch_projects_with_total_volumes().items():
        process_projects_with_sessions.delay(org_id, project_ids)
