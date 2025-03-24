from typing import Protocol

from django.conf import settings

from sentry import options
from sentry.conf.types.kafka_definition import Topic


class TaskRouter(Protocol):
    def route_namespace(self, name: str) -> Topic: ...


class DefaultRouter:
    """Router that uses django settings and options to select topics at runtime"""

    def route_namespace(self, name: str) -> Topic:
        overrides = options.get("taskworker.route.overrides")
        if name in overrides:
            return Topic(overrides[name])
        if name in settings.TASKWORKER_ROUTES:
            return Topic(settings.TASKWORKER_ROUTES[name])
        return Topic.TASK_WORKER
