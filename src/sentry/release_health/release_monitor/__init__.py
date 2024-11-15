from typing import TYPE_CHECKING

from sentry.utils.services import LazyServiceWrapper

from .base import BaseReleaseMonitorBackend

backend = LazyServiceWrapper(
    BaseReleaseMonitorBackend,
    "sentry.release_health.release_monitor.metrics.MetricReleaseMonitorBackend",
    {},
)
backend.expose(locals())

if TYPE_CHECKING:
    __release_monitor_backend__ = BaseReleaseMonitorBackend()
    fetch_projects_with_recent_sessions = (
        __release_monitor_backend__.fetch_projects_with_recent_sessions
    )
    fetch_project_release_health_totals = (
        __release_monitor_backend__.fetch_project_release_health_totals
    )
