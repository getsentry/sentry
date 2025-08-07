from __future__ import annotations

import abc
import logging
import multiprocessing
from collections import defaultdict
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor, wait
from functools import partial
from typing import Generic, Literal, TypeVar

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import BatchStep
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.batching import ValuesBatch
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.locks import locks
from sentry.remote_subscriptions.models import BaseRemoteSubscription
from sentry.utils import metrics
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger(__name__)

T = TypeVar("T")
U = TypeVar("U", bound=BaseRemoteSubscription)

FAKE_SUBSCRIPTION_ID = 12345


class ResultProcessor(abc.ABC, Generic[T, U]):
    def __init__(self, use_subscription_lock: bool = False):
        self.use_subscription_lock = use_subscription_lock

    @property
    @abc.abstractmethod
    def subscription_model(self) -> type[U]:
        pass

    def __call__(self, identifier: str, result: T):
        try:
            # TODO: Handle subscription not existing - we should remove the subscription from
            # the remote system in that case.
            with sentry_sdk.start_transaction(
                name=f"monitors.{identifier}.result_consumer.ResultProcessor",
                op="result_processor.handle_result",
            ):
                subscription = self.get_subscription(result)
                if self.use_subscription_lock and subscription:
                    lock = locks.get(
                        f"subscription:{subscription.type}:{subscription.subscription_id}",
                        duration=10,
                        name=f"subscription_{identifier}",
                    )
                    with TimedRetryPolicy(10)(lock.acquire):
                        self.handle_result(subscription, result)
                else:
                    self.handle_result(subscription, result)
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
    parallel_executor: ThreadPoolExecutor | None = None

    batched_parallel = False
    """
    Does the consumer process unrelated messages in parallel?
    """

    max_batch_size = 500
    """
    How many messages will be batched at once when in parallel mode.
    """

    max_batch_time = 10
    """
    The maximum time in seconds to accumulate a bach of check-ins.
    """

    parallel = False
    """
    Does the consumer process all messages in parallel.
    """

    multiprocessing_pool: MultiprocessingPool | None = None
    input_block_size: int | None = None
    output_block_size: int | None = None

    def __init__(
        self,
        consumer_group: str,
        mode: Literal["batched-parallel", "parallel", "serial"] = "serial",
        max_batch_size: int | None = None,
        max_batch_time: int | None = None,
        max_workers: int | None = None,
        num_processes: int | None = None,
        input_block_size: int | None = None,
        output_block_size: int | None = None,
    ) -> None:
        self.mode = mode
        self.consumer_group = consumer_group
        metric_tags = {"identifier": self.identifier, "mode": self.mode}
        self.result_processor = self.result_processor_cls(use_subscription_lock=mode == "parallel")
        if mode == "batched-parallel":
            self.batched_parallel = True
            self.parallel_executor = ThreadPoolExecutor(max_workers=max_workers)
            if max_workers is None:
                metric_tags["workers"] = "default"
            else:
                metric_tags["workers"] = str(max_workers)
        if mode == "parallel":
            self.parallel = True
            if num_processes is None:
                num_processes = multiprocessing.cpu_count()
            self.multiprocessing_pool = MultiprocessingPool(num_processes)

        metrics.incr(
            "remote_subscriptions.result_consumer.start",
            1,
            tags=metric_tags,
        )

        if max_batch_size is not None:
            self.max_batch_size = max_batch_size
        if max_batch_time is not None:
            self.max_batch_time = max_batch_time
        if input_block_size is not None:
            self.input_block_size = input_block_size
        if output_block_size is not None:
            self.output_block_size = output_block_size

    @property
    @abc.abstractmethod
    def topic_for_codec(self) -> Topic:
        pass

    @property
    @abc.abstractmethod
    def result_processor_cls(self) -> type[ResultProcessor[T, U]]:
        pass

    @abc.abstractmethod
    def build_payload_grouping_key(self, result: T) -> str:
        """
        Used in parallel processing mode. This method should return a string used to
        group related results together for serial processing.
        """
        pass

    @property
    @abc.abstractmethod
    def identifier(self) -> str:
        """
        A unique identifier for this consumer - used to differentiate it in stats
        """
        pass

    def shutdown(self) -> None:
        if self.parallel_executor:
            self.parallel_executor.shutdown()

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        if self.batched_parallel:
            return self.create_thread_parallel_worker(commit)
        if self.parallel:
            return self.create_multiprocess_worker(commit)
        else:
            return self.create_serial_worker(commit)

    def create_serial_worker(self, commit: Commit) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=partial(
                process_single, self.result_processor, self.topic_for_codec, self.identifier
            ),
            next_step=CommitOffsets(commit),
        )

    def create_multiprocess_worker(self, commit: Commit) -> ProcessingStrategy[KafkaPayload]:
        assert self.multiprocessing_pool is not None
        return run_task_with_multiprocessing(
            function=partial(
                process_single, self.result_processor, self.topic_for_codec, self.identifier
            ),
            next_step=CommitOffsets(commit),
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.multiprocessing_pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

    def create_thread_parallel_worker(self, commit: Commit) -> ProcessingStrategy[KafkaPayload]:
        assert self.parallel_executor is not None
        batch_processor = RunTask(
            function=self.process_batch,
            next_step=CommitOffsets(commit),
        )
        return BatchStep(
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            next_step=batch_processor,
        )

    def partition_message_batch(self, message: Message[ValuesBatch[KafkaPayload]]) -> list[list[T]]:
        """
        Takes a batch of messages and partitions them based on the `build_payload_grouping_key` method.
        Returns a generator that yields each partitioned list of messages.
        """
        batch = message.payload

        batch_mapping: Mapping[str, list[T]] = defaultdict(list)
        for item in batch:
            assert isinstance(item, BrokerValue)

            result = decode_payload(self.topic_for_codec, item.payload, self.result_processor)
            if result is None:
                continue

            key = self.build_payload_grouping_key(result)
            batch_mapping[key].append(result)

        # Number of messages that are being processed in this batch
        metrics.gauge(
            "remote_subscriptions.result_consumer.parallel_batch_count",
            len(batch),
            tags={"identifier": self.identifier, "mode": self.mode},
        )
        # Number of groups we've collected to be processed in parallel
        metrics.gauge(
            "remote_subscriptions.result_consumer.parallel_batch_groups",
            len(batch_mapping),
            tags={"identifier": self.identifier, "mode": self.mode},
        )

        return list(batch_mapping.values())

    def process_batch(self, message: Message[ValuesBatch[KafkaPayload]]):
        """
        Receives batches of messages. This function will take the batch and group them together
        using `build_payload_grouping_key`, which ensures order is preserved. Each group is then
        executed using a ThreadPoolWorker.

        By batching we're able to process messages in parallel while guaranteeing that no messages
        are processed out of order.
        """
        assert self.parallel_executor is not None
        partitioned_values = self.partition_message_batch(message)

        # Submit groups for processing
        with sentry_sdk.start_transaction(
            op="process_batch", name=f"monitors.{self.identifier}.result_consumer"
        ):
            futures = [
                self.parallel_executor.submit(self.process_group, group)
                for group in partitioned_values
            ]
            wait(futures)

    def process_group(self, items: list[T]):
        """
        Process a group of related messages serially.
        """
        for item in items:
            self.result_processor(self.identifier, item)


def decode_payload(
    topic_for_codec: Topic,
    payload: KafkaPayload | FilteredPayload,
    result_processor: ResultProcessor[T, U] | None = None,
) -> T | None:
    assert not isinstance(payload, FilteredPayload)

    try:
        codec = get_topic_codec(topic_for_codec)
        return codec.decode(payload.value)
    except Exception:
        logger.exception(
            "Failed to decode message payload",
            extra={"payload": payload.value},
        )
        return None


def process_single(
    result_processor: ResultProcessor[T, U],
    topic: Topic,
    identifier: str,
    message: Message[KafkaPayload | FilteredPayload],
) -> None:
    result = decode_payload(topic, message.payload, result_processor)
    if result is not None:
        result_processor(identifier, result)
