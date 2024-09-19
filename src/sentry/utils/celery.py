from collections.abc import Mapping, MutableSequence, Sequence
from random import randint
from typing import Any

from celery.schedules import crontab
from kombu import Queue

from sentry.conf.types.celery import SplitQueueSize, SplitQueueTaskRoute


def crontab_with_minute_jitter(*args: Any, **kwargs: Any) -> crontab:
    kwargs["minute"] = randint(0, 59)
    return crontab(*args, **kwargs)


def _build_queues(base: str, total: int) -> Sequence[Queue]:
    ret: MutableSequence[Queue] = []
    for index in range(total):
        name = f"{base}_{index + 1}"
        ret.append(Queue(name=name, routing_key=name))
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


def make_split_task_queues(config: Mapping[str, SplitQueueTaskRoute]) -> Sequence[Queue]:
    """
    Generates the split queues definitions from the mapping between
    a task name and a config expressed as `SplitQueueTaskRoute`.
    """
    ret: MutableSequence[Queue] = []
    for conf in config.values():
        ret.extend(_build_queues(conf["default_queue"], conf["queues_config"]["total"]))

    return ret
