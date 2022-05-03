from typing import Mapping, Optional, Union

from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.processing.strategies.streaming import KafkaConsumerStrategyFactory
from arroyo.processing.strategies.streaming.factory import StreamMessageFilter

from sentry.sentry_metrics.multiprocess import get_config, logger


class LastSeenUpdaterMessageFilter(StreamMessageFilter[KafkaPayload]):  # type: ignore
    def should_drop(self, message: KafkaPayload) -> bool:
        return False


class LastSeenUpdaterCollector(ProcessingStrategy[int]):  # type: ignore
    def __init__(self) -> None:
        self.__counter = 0

    def submit(self, message: int) -> None:
        self.__counter += message

    def poll(self) -> None:
        pass

    def terminate(self) -> None:
        pass

    def close(self) -> None:
        pass

    def join(self, timeout: Optional[float] = None) -> None:
        logger.info(f"{self.__counter} messages processed")
        self.__counter = 0


def get_last_seen_updater(
    topic: str,
    group_id: str,
    max_batch_size: int,
    max_batch_time: float,
    auto_offset_reset: str,
    **options: Mapping[str, Union[str, int]],
) -> StreamProcessor:
    processing_factory = KafkaConsumerStrategyFactory(
        max_batch_time=max_batch_time,
        max_batch_size=max_batch_size,
        processes=None,
        input_block_size=None,
        output_block_size=None,
        process_message=lambda message: 1,
        prefilter=LastSeenUpdaterMessageFilter(),
        collector=lambda: LastSeenUpdaterCollector(),
    )
    return StreamProcessor(
        KafkaConsumer(get_config(topic, group_id, auto_offset_reset)),
        Topic(topic),
        processing_factory,
    )
