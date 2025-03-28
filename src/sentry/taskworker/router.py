from functools import cached_property
from typing import Protocol

from django.conf import settings

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.utils import json


class TaskRouter(Protocol):
    def route_namespace(self, name: str) -> Topic: ...


class DefaultRouter:
    """Router that uses django settings and options to select topics at runtime"""

    _route_map: dict[str, str]

    @cached_property
    def _routes(self) -> dict[str, str]:
        try:
            routes = json.loads(settings.TASKWORKER_ROUTES)
        except Exception:
            routes = {}
        return routes

    def route_namespace(self, name: str) -> Topic:
        overrides = options.get("taskworker.route.overrides")
        if name in overrides:
            return Topic(overrides[name])
        if name in self._routes:
            return Topic(self._routes[name])
        return Topic.TASKWORKER
