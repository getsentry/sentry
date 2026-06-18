import os

from django.conf import settings
from django.core.cache import cache
from taskbroker_client.app import TaskbrokerApp
from taskbroker_client.metrics import DatadogMetrics

from sentry.taskworker.adapters import (
    DjangoCacheAtMostOnceStore,
    SentryMetricsBackend,
    SentryRouter,
    ViewerContextHook,
    make_producer,
)

metrics_class = SentryMetricsBackend()
if os.getenv("USE_TASKWORKER_METRICS", None):
    # Metrics created by this interface will not
    # have `sentry.` prefix, and will not have
    # K8S_LABEL applied.
    metrics_class = DatadogMetrics(
        application="sentry",
        statsd_host=os.getenv("HOST_IP", "127.0.0.1"),
        statsd_port=os.getenv("SENTRY_STATSD_PORT", 8126),
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
