from django.conf import settings
from django.core.cache import cache

from sentry.taskworker.app import TaskworkerApp
from sentry.taskworker.registry import taskregistry

app = TaskworkerApp(name="sentry", taskregistry=taskregistry)
app.set_config(
    {
        "rpc_secret": settings.TASKWORKER_SHARED_SECRET,
        "at_most_once_timeout": 60 * 60 * 24,  # 1 day
    }
)
app.set_modules(settings.TASKWORKER_IMPORTS)
app.at_most_once_store(cache)
