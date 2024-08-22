import random
from collections.abc import Iterator, Mapping
from itertools import cycle

from django.conf import settings

from sentry import options
from sentry.celery import app


class SplitQueueRouter:
    def __init__(self) -> None:
        self.__routes_config = settings.CELERY_SPLIT_QUEUE_ROUTES
        known_queues = {c_queue.name for c_queue in app.conf.CELERY_QUEUES}
        routers = {}
        for source, destinations in self.__routes_config.items():
            assert source in known_queues, f"Queue {source} in split queue config is not declared."
            for dest in destinations:
                assert dest in known_queues, f"Queue {dest} in split queue config is not declared."

            routers[source] = cycle(destinations)
        self.__routers: Mapping[str, Iterator[str]] = routers

    def route_to_split_queue(self, queue: str) -> str:
        rollout_rate = options.get("celery_split_queue_rollout").get(queue, 0.0)
        if random.random() >= rollout_rate:
            return queue

        if queue in set(options.get("celery_split_queue_legacy_mode")):
            # Use legacy route
            # This router required to define the routing logic inside the
            # settings file.
            return settings.SENTRY_POST_PROCESS_QUEUE_SPLIT_ROUTER.get(queue, lambda: queue)()
        else:
            router = self.__routers.get(queue)
            if router is not None:
                return next(router)
            else:
                return queue
