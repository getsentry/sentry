from sentry_sdk import capture_message, set_extra

from sentry import options
from sentry.dynamic_sampling.tasks.common import GetActiveOrgs, TimedIterator, TimeoutException
from sentry.dynamic_sampling.tasks.constants import MAX_PROJECTS_PER_QUERY, MAX_TASK_SECONDS
from sentry.dynamic_sampling.tasks.logging import log_task_execution, log_task_timeout
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.collect_orgs",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,
    time_limit=2 * 60 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task
def collect_orgs() -> None:
    enabled = options.get("dynamic-sampling.tasks.collect_orgs") or False

    if not enabled:
        return

    context = TaskContext("sentry.dynamic-sampling.tasks.collect_orgs", MAX_TASK_SECONDS)
    iterator_name = GetActiveOrgs.__name__
    try:
        for orgs in TimedIterator(
            context, GetActiveOrgs(max_projects=MAX_PROJECTS_PER_QUERY), iterator_name
        ):
            pass
    except TimeoutException:
        set_extra("context-data", context.to_dict())
        log_task_timeout(context)
        raise
    else:
        set_extra("context-data", context.to_dict())
        capture_message("Collect orgs")
        log_task_execution(context)
