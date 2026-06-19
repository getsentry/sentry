import logging
import os

from django.conf import settings
from django.core.cache import cache
from taskbroker_client.app import TaskbrokerApp
from taskbroker_client.metrics import DatadogMetrics, MetricsBackend

from sentry.taskworker.adapters import (
    DjangoCacheAtMostOnceStore,
    SentryMetricsBackend,
    SentryRouter,
    ViewerContextHook,
    make_producer,
)

logger = logging.getLogger(__name__)


def _extract_metrics_config() -> tuple[str | None, int | None]:
    host, port = None, None
    metric_options = settings.SENTRY_METRICS_OPTIONS
    try:
        # Use the metrics settings options to infer the host/port.
        # The metrics options have different structures depending on which backend is used.
        if settings.SENTRY_METRICS_BACKEND == "sentry.metrics.dualwrite.DualWriteMetricsBackend":
            metric_options = settings.SENTRY_METRICS_OPTIONS["primary_backend_args"]

        # Some backends use `host` and others use `statsd_host`
        host = metric_options.get("statsd_host", None) or metric_options.get("host", None)
        raw_port = metric_options.get("statsd_port", None) or metric_options.get("port", None)
        if isinstance(raw_port, (str, int)):
            port = int(raw_port)
    except Exception as e:
        logger.warning("Could not extract metrics settings", extra={"error": str(e)})
    return host, port


metrics_class: MetricsBackend = SentryMetricsBackend()

if os.getenv("USE_TASKWORKER_METRICS", None) == "1":
    host, port = _extract_metrics_config()
    if host and port:
        # Metrics created by this interface will not
        # have `sentry.` prefix, and will not have
        # K8S_LABEL applied.
        metrics_class = DatadogMetrics(
            application="sentry",
            statsd_host=host,
            statsd_port=port,
            sample_rate=settings.SENTRY_METRICS_SAMPLE_RATE,
            enable_prefixed_metrics=True,
        )

app = TaskbrokerApp(
    name="sentry",
    producer_factory=make_producer,
    metrics_class=metrics_class,
    router_class=SentryRouter(),
    at_most_once_store=DjangoCacheAtMostOnceStore(cache),
    context_hooks=[ViewerContextHook()],
)
app.set_config(
    {
        "rpc_secret": settings.TASKWORKER_SHARED_SECRET,
        "at_most_once_timeout": 60 * 60 * 24,  # 1 day
    }
)
app.set_modules(settings.TASKWORKER_IMPORTS)
