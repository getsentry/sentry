from django.conf import settings
from django.core.cache import cache

from sentry import options
from sentry.taskworker.app import TaskworkerApp
from sentry.taskworker.registry import taskregistry

app = TaskworkerApp(taskregistry=taskregistry)
app.set_config(
    {
        "rpc_secret": settings.TASKWORKER_SHARED_SECRET,
        "at_most_once_timeout": 60 * 60 * 24,  # 1 day
        "grpc_config": options.get("taskworker.grpc_service_config"),
    }
)
app.set_modules(settings.TASKWORKER_IMPORTS)
app.at_most_once_store(cache)
