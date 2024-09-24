from __future__ import annotations

import abc
import logging
from collections.abc import Mapping
from typing import Generic, TypeVar

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, FilteredPayload, Message, Partition

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.remote_subscriptions.models import BaseRemoteSubscription

logger = logging.getLogger(__name__)

T = TypeVar("T")
U = TypeVar("U", bound=BaseRemoteSubscription)

FAKE_SUBSCRIPTION_ID = 12345


class ResultProcessor(abc.ABC, Generic[T, U]):
    @property
    @abc.abstractmethod
    def subscription_model(self) -> type[U]:
        pass

    def __call__(self, result: T):
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
        self.codec = get_topic_codec(self.topic_for_codec)

    @property
    @abc.abstractmethod
    def topic_for_codec(self) -> Topic:
        pass

    @property
    @abc.abstractmethod
    def result_processor_cls(self) -> type[ResultProcessor[T, U]]:
        pass

    def decode_payload(self, payload: KafkaPayload | FilteredPayload) -> T | None:
        assert not isinstance(payload, FilteredPayload)
        try:
            return self.codec.decode(payload.value)
        except Exception:
            logger.exception(
                "Failed to decode message payload",
                extra={"payload": payload.value},
            )
        return None

    def process_single(self, message: Message[KafkaPayload | FilteredPayload]):
        result = self.decode_payload(message.payload)
        if result is not None:
            self.result_processor(result)

    def create_serial_worker(self, commit: Commit) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=self.process_single,
            next_step=CommitOffsets(commit),
        )

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return self.create_serial_worker(commit)
