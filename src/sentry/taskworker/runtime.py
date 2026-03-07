from typing import cast

from django.conf import settings
from django.core.cache import cache

from sentry.taskworker.app import TaskworkerApp

tb_app = None
sentry_app = None

if settings.TASKWORKER_USE_LIBRARY:
    from taskbroker_client.app import TaskbrokerApp

    from sentry.taskworker.adapters import (
        DjangoCacheAtMostOnceStore,
        SentryMetricsBackend,
        SentryRouter,
        make_producer,
    )

    tb_app = TaskbrokerApp(
        name="sentry",
        producer_factory=make_producer,
        metrics_class=SentryMetricsBackend(),
        router_class=SentryRouter(),
        at_most_once_store=DjangoCacheAtMostOnceStore(cache),
    )
    tb_app.set_config(
        {
            "rpc_secret": settings.TASKWORKER_SHARED_SECRET,
            "at_most_once_timeout": 60 * 60 * 24,  # 1 day
        }
    )
    tb_app.set_modules(settings.TASKWORKER_IMPORTS)
else:
    sentry_app = TaskworkerApp(name="sentry")
    sentry_app.set_config(
        {
            "rpc_secret": settings.TASKWORKER_SHARED_SECRET,
            "at_most_once_timeout": 60 * 60 * 24,  # 1 day
        }
    )
    sentry_app.set_modules(settings.TASKWORKER_IMPORTS)
    sentry_app.at_most_once_store(cache)

if sentry_app:
    app = sentry_app
else:
    assert tb_app
    app = cast(TaskworkerApp, tb_app)
