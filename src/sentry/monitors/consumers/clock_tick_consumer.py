from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.monitors_clock_tick_v1 import ClockTick

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.monitors.clock_tasks.check_missed import dispatch_check_missing
from sentry.monitors.clock_tasks.check_timeout import dispatch_check_timeout
from sentry.monitors.system_incidents import process_clock_tick_for_system_incidents

logger = logging.getLogger(__name__)

MONITORS_CLOCK_TICK_CODEC: Codec[ClockTick] = get_topic_codec(Topic.MONITORS_CLOCK_TICK)


def process_clock_tick(message: Message[KafkaPayload | FilteredPayload]):
    assert not isinstance(message.payload, FilteredPayload)
    assert isinstance(message.value, BrokerValue)

    wrapper: ClockTick = MONITORS_CLOCK_TICK_CODEC.decode(message.payload.value)
    ts = datetime.fromtimestamp(wrapper["ts"], tz=timezone.utc)

    logger.info(
        "process_clock_tick",
        extra={"reference_datetime": str(ts)},
    )

    try:
        process_clock_tick_for_system_incidents(ts)
    except Exception:
        logger.exception("failed_process_clock_tick_for_system_incidents")

    dispatch_check_missing(ts)
    dispatch_check_timeout(ts)


class MonitorClockTickStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        pass

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_clock_tick,
            next_step=CommitOffsets(commit),
        )
