from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import TypeGuard

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import (
    MarkMissing,
    MarkTimeout,
    MarkUnknown,
    MonitorsClockTasks,
)

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.monitors.clock_tasks.check_missed import mark_environment_missing
from sentry.monitors.clock_tasks.check_timeout import mark_checkin_timeout
from sentry.monitors.clock_tasks.mark_unknown import mark_checkin_unknown

MONITORS_CLOCK_TASKS_CODEC: Codec[MonitorsClockTasks] = get_topic_codec(Topic.MONITORS_CLOCK_TASKS)

logger = logging.getLogger(__name__)


def is_mark_timeout(wrapper: MonitorsClockTasks) -> TypeGuard[MarkTimeout]:
    return wrapper["type"] == "mark_timeout"


def is_mark_unknown(wrapper: MonitorsClockTasks) -> TypeGuard[MarkUnknown]:
    return wrapper["type"] == "mark_unknown"


def is_mark_missing(wrapper: MonitorsClockTasks) -> TypeGuard[MarkMissing]:
    return wrapper["type"] == "mark_missing"


def process_clock_task(message: Message[KafkaPayload | FilteredPayload]):
    assert not isinstance(message.payload, FilteredPayload)
    assert isinstance(message.value, BrokerValue)

    try:
        wrapper = MONITORS_CLOCK_TASKS_CODEC.decode(message.payload.value)
        ts = datetime.fromtimestamp(wrapper["ts"], tz=timezone.utc)

        if is_mark_timeout(wrapper):
            mark_checkin_timeout(int(wrapper["checkin_id"]), ts)
            return

        if is_mark_unknown(wrapper):
            mark_checkin_unknown(int(wrapper["checkin_id"]), ts)
            return

        if is_mark_missing(wrapper):
            mark_environment_missing(int(wrapper["monitor_environment_id"]), ts)
            return

        logger.error("Unsupported clock-tick task type: %s", wrapper["type"])
    except Exception:
        logger.exception("Failed to process clock tick task")


class MonitorClockTasksStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        pass

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        # XXX(epurkihser): We're going to want to add some form of parallelism
        # here, but we'll need to be careful that we keep tasks grouped by
        # their partitions.
        return RunTask(
            function=process_clock_task,
            next_step=CommitOffsets(commit),
        )
