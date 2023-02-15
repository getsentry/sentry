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
from sentry.eventstream.kafka.protocol import (
    get_task_kwargs_for_message,
    get_task_kwargs_for_message_from_headers,
)
from sentry.utils import metrics

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
