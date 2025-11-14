from typing import int, Protocol

from django.conf import settings
from sentry_sdk import capture_exception

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.silo.base import SiloMode
from sentry.utils import json


class TaskRouter(Protocol):
    def route_namespace(self, name: str) -> Topic: ...


class DefaultRouter:
    """Router that uses django settings and options to select topics at runtime"""

    _route_map: dict[str, str]
    _default_topic: Topic

    def __init__(self) -> None:
        routes = {}
        if settings.TASKWORKER_ROUTES:
            try:
                routes = json.loads(settings.TASKWORKER_ROUTES)
            except Exception as err:
                capture_exception(err)
        self._route_map = routes
        # Cache the default topic based on silo mode at initialization time
        self._default_topic = (
            Topic.TASKWORKER_CONTROL
            if SiloMode.get_current_mode() == SiloMode.CONTROL
            else Topic.TASKWORKER
        )

    def route_namespace(self, name: str) -> Topic:
        overrides = options.get("taskworker.route.overrides")
        if name in overrides:
            return Topic(overrides[name])
        if name in self._route_map:
            return Topic(self._route_map[name])
        return self._default_topic
