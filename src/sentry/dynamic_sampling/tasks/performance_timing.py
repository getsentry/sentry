from sentry import options
from sentry.dynamic_sampling import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import get_active_orgs_with_projects_counts
from sentry.dynamic_sampling.tasks.utils import Timer
from sentry.tasks.base import instrumented_task

PERFORMANCE_TIMING_LOCK_NAME = "ds:performance_timing"


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.performance_timing",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,
    time_limit=2 * 60 * 60 + 5,
)
def performance_timing() -> None:
    enabled = options.get("dynamic-sampling.timing.task") or False

    if not enabled:
        return

    if not task_lock(PERFORMANCE_TIMING_LOCK_NAME, 60):
        # the task is already running don't run it again
        return

    try:
        time_active_orgs_with_project_counts()

    finally:
        task_unlock(PERFORMANCE_TIMING_LOCK_NAME)


def time_active_orgs_with_project_counts():
    """
    Measures the time of get_active_orgs_with_project_counts()
    :return:
    """
    enabled = options.get("dynamic-sampling.timing.get_active_orgs_with_project_counts")

    if not enabled:
        return

    num_orgs = options.get("dynamic-sampling.timing.get_active_orgs_with_project_counts.num_orgs")

    t = Timer("get_active_orgs_with_projects_counts")
    t.start()
    org_count = 0
    for orgs in get_active_orgs_with_projects_counts(num_orgs):
        org_count += len(orgs)
        t.log_current(
            extra={
                "orgs": org_count,
                "maxOrgsPerQuery": num_orgs,
            }
        )
        task_lock_lease(PERFORMANCE_TIMING_LOCK_NAME, 60)


def task_lock(task_name: str, timeout_sec=60) -> bool:
    """
    Tries to acquire a lock with the specified name,
    and reserves it for the specified amount of time if successful
    """
    client = get_redis_client_for_ds()

    return client.set(task_name, "locked", nx=True, ex=timeout_sec) or False


def task_lock_lease(task_name: str, timeout_sec=60):
    """
    Increases the lease of a lock by timeout seconds
    You must have locked the task first
    (otherwise you'll just take the lock over without any other check)
    """
    client = get_redis_client_for_ds()
    client.set(task_name, "locked", ex=timeout_sec)


def task_unlock(task_name: str):
    """
    Removes a lock

    You must have locked the task first
    (otherwise you'll release a lock that doesn't belong to you)
    """
    client = get_redis_client_for_ds()
    client.delete(task_name)
