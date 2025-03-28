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

    def __init__(self) -> None:
        try:
            routes = json.loads(settings.TASKWORKER_ROUTES)
        except Exception:
            routes = {}
        self._route_map = routes

    def route_namespace(self, name: str) -> Topic:
        overrides = options.get("taskworker.route.overrides")
        if name in overrides:
            return Topic(overrides[name])
        if name in self._route_map:
            return Topic(self._route_map[name])
        return Topic.TASKWORKER
