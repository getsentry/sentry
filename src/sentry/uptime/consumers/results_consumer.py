from __future__ import annotations

import logging
from collections.abc import Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.uptime_results_v1 import CHECKSTATUS_FAILURE, CheckResult

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.uptime.issue_platform import create_issue_platform_occurrence

logger = logging.getLogger(__name__)

UPTIME_RESULTS_CODEC: Codec[CheckResult] = get_topic_codec(Topic.UPTIME_RESULTS)


def process_result(message: Message[KafkaPayload | FilteredPayload]):
    assert not isinstance(message.payload, FilteredPayload)
    assert isinstance(message.value, BrokerValue)

    try:
        result: CheckResult = UPTIME_RESULTS_CODEC.decode(message.payload.value)
        if result["status"] == CHECKSTATUS_FAILURE:
            create_issue_platform_occurrence(result)

        # XXX(epurkhiser): This consumer literally does nothing except log right now
        logger.info("process_result", extra=result)
    except Exception:
        logger.info(
            "process_failed",
            extra={"payload": message.payload.value},
            exc_info=True,
        )


class UptimeResultsStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        pass

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_result,
            next_step=CommitOffsets(commit),
        )
