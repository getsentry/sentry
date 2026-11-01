from django.conf import settings
from django.core.cache import cache
from taskbroker_client.app import TaskbrokerApp

from sentry.runner.boot_gc import frozen_after_boot
from sentry.taskworker.adapters import (
    DjangoCacheAtMostOnceStore,
    SentryRouter,
    ViewerContextHook,
    make_metrics,
    make_producer,
)


class SentryTaskbrokerApp(TaskbrokerApp):
    def load_modules(self) -> None:
        # Worker children and the scheduler import every task module after
        # configure() has frozen the boot heap, and keep them for their whole
        # lifetime. Freeze them as well. See sentry.runner.boot_gc.
        with frozen_after_boot("taskworker_load_modules"):
            super().load_modules()


app = SentryTaskbrokerApp(
    name="sentry",
    producer_factory=make_producer,
    metrics_class=make_metrics(),
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
