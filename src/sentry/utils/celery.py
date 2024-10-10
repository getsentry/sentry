from collections.abc import Mapping, MutableSequence, Sequence
from random import randint
from typing import Any

from celery.schedules import crontab
from kombu import Queue

from sentry.conf.types.celery import SplitQueueSize, SplitQueueTaskRoute


def crontab_with_minute_jitter(*args: Any, **kwargs: Any) -> crontab:
    kwargs["minute"] = randint(0, 59)
    return crontab(*args, **kwargs)


def build_queue_names(base_name: str, quantity: int) -> Sequence[str]:
    ret = []
    for index in range(quantity):
        name = f"{base_name}_{index + 1}"
        ret.append(name)
    return ret


def _build_queues(base: str, quantity: int) -> Sequence[Queue]:
    return [Queue(name=name, routing_key=name) for name in build_queue_names(base, quantity)]


def make_split_task_queues(config: Mapping[str, SplitQueueTaskRoute]) -> list[Queue]:
    """
    Generates the split queues definitions from the mapping between
    a task name and a config expressed as `SplitQueueTaskRoute`.
    """
    ret: list[Queue] = []
    for conf in config.values():
        if "queues_config" in conf:
            ret.extend(_build_queues(conf["default_queue"], conf["queues_config"]["total"]))
    return ret


def make_split_queues(config: Mapping[str, SplitQueueSize]) -> Sequence[Queue]:
    """
    Generates the split queue definitions from the mapping between
    base queue and split queue config.
    """
    ret: MutableSequence[Queue] = []
    for base_name, conf in config.items():
        ret.extend(_build_queues(base_name, conf["total"]))

    return ret


def safe_append(queues: MutableSequence[Queue], queue: Queue) -> None:
    """
    We define queues as lists in the configuration and we allow override
    of the config per environment.
    Unfortunately if you add twice a queue with the same name to the celery
    config. Celery just creates the queue twice. This can be an undesired behavior
    depending on the Celery backend. So this method allows to add queues to
    a list without duplications.
    """
    existing_queue_names = {q.name for q in queues}
    if queue.name not in existing_queue_names:
        queues.append(queue)


def safe_extend(queues: MutableSequence[Queue], to_add: Sequence[Queue]) -> None:
    """
    Like `safe_append` but it works like extend adding multiple queues
    to the config.
    """
    existing_queue_names = {q.name for q in queues}
    for q in to_add:
        if q.name not in existing_queue_names:
            queues.append(q)
