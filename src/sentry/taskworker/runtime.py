from django.conf import settings
from django.core.cache import cache

if settings.TASKWORKER_USE_LIBRARY:
    from taskbroker_client.app import TaskbrokerApp

    from sentry.taskworker.adapters import (
        DjangoCacheAtMostOnceStore,
        SentryMetricsBackend,
        SentryRouter,
        make_producer,
    )

    app = TaskbrokerApp(
        name="sentry",
        producer_factory=make_producer,
        metrics_class=SentryMetricsBackend(),
        router_class=SentryRouter(),
        at_most_once_store=DjangoCacheAtMostOnceStore(cache),
    )
    app.set_config(
        {
            "rpc_secret": settings.TASKWORKER_SHARED_SECRET,
            "at_most_once_timeout": 60 * 60 * 24,  # 1 day
        }
    )
    app.set_modules(settings.TASKWORKER_IMPORTS)
else:
    from sentry.taskworker.app import TaskworkerApp

    app = TaskworkerApp(name="sentry")
    app.set_config(
        {
            "rpc_secret": settings.TASKWORKER_SHARED_SECRET,
            "at_most_once_timeout": 60 * 60 * 24,  # 1 day
        }
    )
    app.set_modules(settings.TASKWORKER_IMPORTS)
    app.at_most_once_store(cache)
