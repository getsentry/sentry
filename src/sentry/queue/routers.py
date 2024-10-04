import logging
import random
from collections.abc import Sequence
from itertools import cycle

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
