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
from sentry.monitors.clock_tasks.mark_unknown import dispatch_mark_unknown
from sentry.monitors.types import TickVolumeAnomolyResult

logger = logging.getLogger(__name__)

MONITORS_CLOCK_TICK_CODEC: Codec[ClockTick] = get_topic_codec(Topic.MONITORS_CLOCK_TICK)


def process_clock_tick(message: Message[KafkaPayload | FilteredPayload]):
    assert not isinstance(message.payload, FilteredPayload)
    assert isinstance(message.value, BrokerValue)

    wrapper: ClockTick = MONITORS_CLOCK_TICK_CODEC.decode(message.payload.value)
    ts = datetime.fromtimestamp(wrapper["ts"], tz=timezone.utc)

    volume_anomaly_result = TickVolumeAnomolyResult.from_str(
        wrapper.get("volume_anomaly_result", "normal")
    )

    logger.info(
        "process_clock_tick",
        extra={"reference_datetime": str(ts), "volume_anomaly_result": volume_anomaly_result.value},
    )

    dispatch_check_missing(ts)

    # When the tick is anomalys we are unable to mark timeouts, since it is
    # possible that a OK check-in was sent completing an earlier in-progress
    # check-in during a period of data-loss. In this scenario instead we need
    # to mark ALL in-progress check-ins as unknown, since they may time-out in
    # the future if we lost the in-progress check-in.
    match volume_anomaly_result:
        case TickVolumeAnomolyResult.NORMAL:
            dispatch_check_timeout(ts)
        case TickVolumeAnomolyResult.ABNORMAL:
            dispatch_mark_unknown(ts)


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
