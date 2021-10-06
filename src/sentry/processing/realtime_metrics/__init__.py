from typing import TYPE_CHECKING

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import RealtimeMetricsStore

realtime_metrics_store: RealtimeMetricsStore = LazyServiceWrapper(
    RealtimeMetricsStore,
    settings.SENTRY_REALTIME_METRICS_BACKEND,
    settings.SENTRY_REALTIME_METRICS_OPTIONS,
)

realtime_metrics_store.expose(locals())

if TYPE_CHECKING:
    # This is all too dynamic for mypy, so manually set the same attributes from
    # RealtimeMetricsStore.__all__:
    validate = realtime_metrics_store.validate
    increment_project_event_counter = realtime_metrics_store.increment_project_event_counter
    increment_project_duration_counter = realtime_metrics_store.increment_project_duration_counter
    projects = realtime_metrics_store.projects
    get_counts_for_project = realtime_metrics_store.get_counts_for_project
    get_durations_for_project = realtime_metrics_store.get_durations_for_project
    get_lpq_projects = realtime_metrics_store.get_lpq_projects
    is_lpq_project = realtime_metrics_store.is_lpq_project
    add_project_to_lpq = realtime_metrics_store.add_project_to_lpq
    remove_projects_from_lpq = realtime_metrics_store.remove_projects_from_lpq
