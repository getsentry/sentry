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


def make_split_queues(config: Mapping[str, SplitQueueSize]) -> Sequence[Queue]:
    """
    Generates the split queue definitions from the mapping between
    base queue and split queue config.
    """
    ret: MutableSequence[Queue] = []
    for base_name, conf in config.items():
        ret.extend(_build_queues(base_name, conf["total"]))

    return ret


def make_split_task_queues(config: Mapping[str, SplitQueueTaskRoute]) -> Sequence[Queue]:
    """
    Generates the split queues definitions from the mapping between
    a task name and a config expressed as `SplitQueueTaskRoute`.
    """
    ret: MutableSequence[Queue] = []
    for conf in config.values():
        ret.extend(_build_queues(conf["default_queue"], conf["queues_config"]["total"]))

    return ret
