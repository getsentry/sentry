from sentry.utils.services import LazyServiceWrapper

from .base import ReleaseHealthBackend

backend = LazyServiceWrapper(
    ReleaseHealthBackend,
    "sentry.releases.release_health.metrics.MetricsReleaseHealthBackend",
    {},
)
backend.expose(locals())
