from __future__ import annotations

import abc
import logging
from collections.abc import Mapping
from typing import Generic, TypeVar

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas.codecs import Codec

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.remote_subscriptions.models import BaseRemoteSubscription

logger = logging.getLogger(__name__)

T = TypeVar("T")
U = TypeVar("U", bound=BaseRemoteSubscription, covariant=True)


class ResultProcessor(abc.ABC, Generic[T, U]):
    def __init__(self, codec: Codec[T]):
        self.codec = codec

    @property
    @abc.abstractmethod
    def subscription_model(self) -> type[U]:
        pass

    def __call__(self, message: Message[KafkaPayload | FilteredPayload]):
        assert not isinstance(message.payload, FilteredPayload)
        assert isinstance(message.value, BrokerValue)

        try:
            result = self.codec.decode(message.payload.value)
        except Exception:
            logger.exception(
                "Failed to decode message payload",
                extra={"payload": message.payload.value},
            )
        try:
            self.handle_result(result)
        except Exception:
            logger.exception("Failed to process message result")

    def get_subscription(self, result: T) -> U:
        return self.subscription_model.objects.get_from_cache(
            subscription_id=self.get_subscription_id(result)
        )

    @abc.abstractmethod
    def get_subscription_id(self, result: T) -> str:
        pass

    @abc.abstractmethod
    def handle_result(self, result: T):
        pass


class ResultsStrategyFactory(ProcessingStrategyFactory[KafkaPayload], Generic[T, U]):
    def __init__(self, topic: Topic) -> None:
        self.result_processor = self.result_processor_cls(get_topic_codec(topic))

    @property
    @abc.abstractmethod
    def result_processor_cls(self) -> type[ResultProcessor[T, U]]:
        pass

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=self.result_processor,
            next_step=CommitOffsets(commit),
        )
