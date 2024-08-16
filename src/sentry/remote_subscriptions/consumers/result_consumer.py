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

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.remote_subscriptions.models import BaseRemoteSubscription

logger = logging.getLogger(__name__)

T = TypeVar("T")
U = TypeVar("U", bound=BaseRemoteSubscription)

FAKE_SUBSCRIPTION_ID = 12345


class ResultProcessor(abc.ABC, Generic[T, U]):
    def __init__(self):
        self.codec = get_topic_codec(self.topic_for_codec)

    @property
    @abc.abstractmethod
    def subscription_model(self) -> type[U]:
        pass

    @property
    @abc.abstractmethod
    def topic_for_codec(self) -> Topic:
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
            # TODO: Handle subscription not existing - we should remove the subscription from
            # the remote system in that case.
            self.handle_result(self.get_subscription(result), result)
        except Exception:
            logger.exception("Failed to process message result")

    def get_subscription(self, result: T) -> U | None:
        try:
            return self.subscription_model.objects.get_from_cache(
                subscription_id=self.get_subscription_id(result)
            )
        except self.subscription_model.DoesNotExist:
            return None

    @abc.abstractmethod
    def get_subscription_id(self, result: T) -> str:
        pass

    @abc.abstractmethod
    def handle_result(self, subscription: U | None, result: T):
        pass


class ResultsStrategyFactory(ProcessingStrategyFactory[KafkaPayload], Generic[T, U]):
    def __init__(self) -> None:
        self.result_processor = self.result_processor_cls()

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
