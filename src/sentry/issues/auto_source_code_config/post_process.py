from sentry.eventstore.models import GroupEvent
from sentry.tasks.auto_source_code_config import auto_source_code_config
from sentry.utils.cache import cache

from .stacktraces import identify_stacktrace_paths
from .utils import supported_platform


def schedule_event_processing(event: GroupEvent) -> None:
    project = event.project
    group_id = event.group_id

    if not supported_platform(event.data.get("platform")):
        return

    stacktrace_paths = identify_stacktrace_paths(event.data)
    if not stacktrace_paths:
        return

    # To limit the overall number of tasks, only process one issue per project per hour. In
    # order to give the most issues a chance to to be processed, don't reprocess any given
    # issue for at least 24 hours.
    project_cache_key = f"code-mappings:project:{project.id}"
    issue_cache_key = f"code-mappings:group:{group_id}"
    if cache.get(project_cache_key) is None and cache.get(issue_cache_key) is None:
        cache.set(project_cache_key, True, 3600)  # 1 hour
        cache.set(issue_cache_key, True, 86400)  # 24 hours
    else:
        return

    auto_source_code_config.delay(project.id, event_id=event.event_id, group_id=group_id)
