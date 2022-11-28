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
    record_project_duration = __realtime_metrics_store__.record_project_duration
    projects = __realtime_metrics_store__.projects
    get_used_budget_for_project = __realtime_metrics_store__.get_used_budget_for_project
    get_lpq_projects = __realtime_metrics_store__.get_lpq_projects
    is_lpq_project = __realtime_metrics_store__.is_lpq_project
    add_project_to_lpq = __realtime_metrics_store__.add_project_to_lpq
    remove_projects_from_lpq = __realtime_metrics_store__.remove_projects_from_lpq
