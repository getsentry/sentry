from __future__ import annotations

import logging
import random
import time
from collections import defaultdict
from contextlib import contextmanager
from enum import Enum
from threading import Lock
from typing import Any, Generator, Mapping, MutableMapping, Optional, Tuple

from sentry import options
from sentry.eventstream.base import GroupStates
from sentry.eventstream.kafka.protocol import (
    get_task_kwargs_for_message,
    get_task_kwargs_for_message_from_headers,
)
from sentry.tasks.post_process import post_process_group
from sentry.utils import metrics
from sentry.utils.cache import cache_key_for_event

logger = logging.getLogger(__name__)

Message = Any
_DURATION_METRIC = "eventstream.duration"
_MESSAGES_METRIC = "eventstream.messages"


class PostProcessForwarderType(str, Enum):
    ERRORS = "errors"
    TRANSACTIONS = "transactions"
    ISSUE_PLATFORM = "issue_platform"


@contextmanager
def _sampled_eventstream_timer(instance: str) -> Generator[None, None, None]:
    record_metric = random.random() < 0.1
    if record_metric is True:
        with metrics.timer(_DURATION_METRIC, instance=instance):
            yield
    else:
        yield


def _get_task_kwargs(message: Message) -> Optional[Mapping[str, Any]]:
    use_kafka_headers = options.get("post-process-forwarder:kafka-headers")

    if use_kafka_headers:
        try:
            with _sampled_eventstream_timer(instance="get_task_kwargs_for_message_from_headers"):
                return get_task_kwargs_for_message_from_headers(message.headers())
        except Exception as error:
            logger.error("Could not forward message: %s", error, exc_info=True)
            with metrics.timer(_DURATION_METRIC, instance="get_task_kwargs_for_message"):
                return get_task_kwargs_for_message(message.value())
    else:
        with metrics.timer(_DURATION_METRIC, instance="get_task_kwargs_for_message"):
            return get_task_kwargs_for_message(message.value())


__metrics: MutableMapping[Tuple[int, str], int] = defaultdict(int)
__metric_record_freq_sec = 1.0
__last_flush = time.time()
__lock = Lock()


def _record_metrics(partition: int, task_kwargs: Mapping[str, Any]) -> None:
    """
    Records the number of messages processed per partition. Metric is flushed every second.
    """
    global __metrics
    global __last_flush
    # TODO: Fix this, it's already broken for transactions with groups
    event_type = "transactions" if task_kwargs["group_id"] is None else "errors"
    __metrics[(partition, event_type)] += 1

    current_time = time.time()
    if current_time - __last_flush > __metric_record_freq_sec:
        with __lock:
            metrics_to_send = __metrics
            __metrics = defaultdict(int)
            __last_flush = current_time
        for ((partition, event_type), count) in metrics_to_send.items():
            metrics.incr(
                _MESSAGES_METRIC,
                amount=count,
                tags={"partition": partition, "type": event_type},
                sample_rate=1,
            )


def dispatch_post_process_group_task(
    event_id: str,
    project_id: int,
    group_id: Optional[int],
    is_new: bool,
    is_regression: Optional[bool],
    is_new_group_environment: bool,
    primary_hash: Optional[str],
    queue: str,
    skip_consume: bool = False,
    group_states: Optional[GroupStates] = None,
    occurrence_id: Optional[str] = None,
) -> None:
    if skip_consume:
        logger.info("post_process.skip.raw_event", extra={"event_id": event_id})
    else:
        cache_key = cache_key_for_event({"project": project_id, "event_id": event_id})

        post_process_group.apply_async(
            kwargs={
                "is_new": is_new,
                "is_regression": is_regression,
                "is_new_group_environment": is_new_group_environment,
                "primary_hash": primary_hash,
                "cache_key": cache_key,
                "group_id": group_id,
                "group_states": group_states,
                "occurrence_id": occurrence_id,
            },
            queue=queue,
        )


def _get_task_kwargs_and_dispatch(message: Message) -> None:
    task_kwargs = _get_task_kwargs(message)
    if not task_kwargs:
        return None

    _record_metrics(message.partition(), task_kwargs)
    dispatch_post_process_group_task(**task_kwargs)
