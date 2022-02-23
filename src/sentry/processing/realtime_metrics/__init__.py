from typing import TYPE_CHECKING

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import RealtimeMetricsStore

backend = LazyServiceWrapper(
    RealtimeMetricsStore,
    settings.SENTRY_REALTIME_METRICS_BACKEND,
    settings.SENTRY_REALTIME_METRICS_OPTIONS,
)
backend.expose(locals())

if TYPE_CHECKING:
    # This is all too dynamic for mypy, so manually set the same attributes from
    # RealtimeMetricsStore.__all__:
    __realtime_metrics_store__ = RealtimeMetricsStore()
    validate = __realtime_metrics_store__.validate
    increment_project_event_counter = __realtime_metrics_store__.increment_project_event_counter
    increment_project_duration_counter = (
        __realtime_metrics_store__.increment_project_duration_counter
    )
    projects = __realtime_metrics_store__.projects
    get_counts_for_project = __realtime_metrics_store__.get_counts_for_project
    get_durations_for_project = __realtime_metrics_store__.get_durations_for_project
    get_lpq_projects = __realtime_metrics_store__.get_lpq_projects
    is_lpq_project = __realtime_metrics_store__.is_lpq_project
    add_project_to_lpq = __realtime_metrics_store__.add_project_to_lpq
    remove_projects_from_lpq = __realtime_metrics_store__.remove_projects_from_lpq
