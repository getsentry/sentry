import random
from collections.abc import Iterator, Mapping, Sequence
from itertools import cycle
from typing import Any, NamedTuple

from django.conf import settings

from sentry import options
from sentry.celery import app


def _get_known_queues() -> set[str]:
    return {c_queue.name for c_queue in app.conf.CELERY_QUEUES}


def _validate_destiantions(destinations: Sequence[str]) -> None:
    for dest in destinations:
        assert dest in _get_known_queues(), f"Queue {dest} in split queue config is not declared."


class SplitQueueRouter:
    def __init__(self) -> None:
        known_queues = _get_known_queues()
        self.__queue_routers = {}
        for source, destinations in settings.CELERY_SPLIT_QUEUE_ROUTES.items():
            assert source in known_queues, f"Queue {source} in split queue config is not declared."
            _validate_destiantions(destinations)
            self.__queue_routers[source] = cycle(destinations)

    def route_for_queue(self, queue: str) -> str:
        rollout_rate = options.get("celery_split_queue_rollout").get(queue, 0.0)
        if random.random() >= rollout_rate:
            return queue

        if queue in set(options.get("celery_split_queue_legacy_mode")):
            # Use legacy route
            # This router required to define the routing logic inside the
            # settings file.
            return settings.SENTRY_POST_PROCESS_QUEUE_SPLIT_ROUTER.get(queue, lambda: queue)()
        else:
            router = self.__queue_routers.get(queue)
            if router is not None:
                return next(router)
            else:
                return queue


class TaskRoute(NamedTuple):
    default_queue: str
    queues: Iterator[str]


class SplitQueueTaskRouter:
    def __init__(self) -> None:
        known_queues = _get_known_queues()

        self.__task_routers = {}
        for source, destinations in settings.CELERY_SPLIT_QUEUE_TASK_ROUTES.items():
            default_destination = destinations[1]
            assert (
                default_destination in known_queues
            ), f"Queue {default_destination} in split queue config is not declared."
            _validate_destiantions(destinations[0])

            self.__task_routers[source] = TaskRoute(default_destination, cycle(destinations[0]))

    def route_for_task(self, task: str, *args: Any, **kwargs: Any) -> Mapping[str, str] | None:
        route = self.__task_routers.get(task)
        if route is None:
            return None

        rollout_rate = options.get("celery_split_queue_task_rollout").get(task, 0.0)
        if random.random() >= rollout_rate:
            return {"queue": route.default_queue}

        return {"queue": next(route.queues)}
