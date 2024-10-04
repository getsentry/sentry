import logging
import random
from collections.abc import Iterator, Mapping, Sequence
from itertools import cycle
from typing import Any, NamedTuple

from django.conf import settings

from sentry import options
from sentry.celery import app
from sentry.utils.celery import build_queue_names

logger = logging.getLogger(__name__)


def _get_known_queues() -> set[str]:
    return {c_queue.name for c_queue in app.conf.CELERY_QUEUES}


def _validate_destinations(destinations: Sequence[str]) -> None:
    for dest in destinations:
        assert dest in _get_known_queues(), f"Queue {dest} in split queue config is not declared."


class TaskRoute(NamedTuple):
    default_queue: str
    queues: Iterator[str]


class SplitQueueTaskRouter:
    """
    Routes tasks to split queues.

    As for `SplitQueueRouter` this is meant to spread the load of a queue
    to a number of split queues.

    The main difference is that this is a router used directly by Celery.
    It is configured as the main router via the `CELERY_ROUTES` setting.
    Every time a task is scheduled that does not define a queue this router
    is used and it maps a task to a queue.

    Split queues can be rolled out individually via options.
    """

    def __init__(self) -> None:
        known_queues = _get_known_queues()

        self.__task_routers = {}
        for task, dest_config in settings.CELERY_SPLIT_QUEUE_TASK_ROUTES.items():
            default_destination = dest_config["default_queue"]
            assert (
                default_destination in known_queues
            ), f"Queue {default_destination} in split queue config is not declared."
            if "queues_config" in dest_config:
                queues_config = dest_config["queues_config"]
                assert queues_config["in_use"] <= queues_config["total"]
                if queues_config["in_use"] >= 2:
                    destinations = build_queue_names(default_destination, queues_config["in_use"])
                    _validate_destinations(destinations)
                else:
                    logger.error(
                        "Invalid configuration for task %s. In use is not greater than 1: %d. Fall back to source",
                        task,
                        queues_config["in_use"],
                    )
                    destinations = [dest_config["default_queue"]]
            else:
                # This is the case where a specific environment does not want to
                # split the queues. The settings must be there anyway.
                destinations = [dest_config["default_queue"]]

            # It is critical to add a TaskRoute even if the configuration is invalid
            # or if the setting does not contain queues spec. This is because
            # the task, in this case does not define the queue name, so the router
            # has to provide the default one.
            self.__task_routers[task] = TaskRoute(default_destination, cycle(destinations))

    def route_for_task(self, task: str, *args: Any, **kwargs: Any) -> Mapping[str, str] | None:
        route = self.__task_routers.get(task)

        if route is None:
            return None

        rollout_rate = options.get("celery_split_queue_task_rollout").get(task, 0.0)
        if random.random() >= rollout_rate:
            return {"queue": route.default_queue}

        return {"queue": next(route.queues)}


class SplitQueueRouter:
    """
    Returns the split queue to use for a Celery queue.
    Split queues allow us to spread the load of a queue to multiple ones.
    This takes in input a queue name and returns the split. It is supposed
    to be used by the code that schedules the task.
    Each split queue can be individually rolled out via options.
    WARNING: Do not forget to configure your workers to listen to the
    queues appropriately before you start routing messages.
    """

    def __init__(self) -> None:
        known_queues = _get_known_queues()
        self.__queue_routers = {}
        for source, dest_config in settings.CELERY_SPLIT_QUEUE_ROUTES.items():
            assert source in known_queues, f"Queue {source} in split queue config is not declared."
            assert dest_config["in_use"] <= dest_config["total"]

            if dest_config["in_use"] >= 2:
                destinations = build_queue_names(source, dest_config["in_use"])
                _validate_destinations(destinations)
                self.__queue_routers[source] = cycle(destinations)
            else:
                logger.error(
                    "Invalid configuration for queue %s. In use is not greater than 1: %d. Fall back to source",
                    source,
                    dest_config["in_use"],
                )

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
