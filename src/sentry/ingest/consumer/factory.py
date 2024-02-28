from __future__ import annotations

from collections.abc import Callable, Mapping
from functools import partial
from typing import NamedTuple, TypeVar

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    FilterStep,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTask,
)
from arroyo.types import Commit, FilteredPayload, Message, Partition

from sentry.ingest.types import ConsumerType
from sentry.processing.backpressure.arroyo import HealthChecker, create_backpressure_step
from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing

from .attachment_event import decode_and_process_chunks, process_attachments_and_events
from .simple_event import process_simple_event_message


class MultiProcessConfig(NamedTuple):
    num_processes: int
    max_batch_size: int
    max_batch_time: int
    input_block_size: int | None
    output_block_size: int | None


TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")


def maybe_multiprocess_step(
    mp: MultiProcessConfig | None,
    function: Callable[[Message[TInput]], TOutput],
    next_step: ProcessingStrategy[FilteredPayload | TOutput],
    pool: MultiprocessingPool | None,
) -> ProcessingStrategy[FilteredPayload | TInput]:
    if mp is not None:
        assert pool is not None
        return RunTaskWithMultiprocessing(
            function=function,
            next_step=next_step,
            max_batch_size=mp.max_batch_size,
            max_batch_time=mp.max_batch_time,
            pool=pool,
            input_block_size=mp.input_block_size,
            output_block_size=mp.output_block_size,
        )
    else:
        return RunTask(
            function=function,
            next_step=next_step,
        )


class IngestStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        consumer_type: str,
        num_processes: int,
        max_batch_size: int,
        max_batch_time: int,
        input_block_size: int | None,
        output_block_size: int | None,
    ):
        self.consumer_type = consumer_type
        self.is_attachment_topic = consumer_type == ConsumerType.Attachments

        self.multi_process = None
        self._pool = MultiprocessingPool(num_processes)

        # XXX: Attachment topic has two multiprocessing strategies chained together so we use
        # two pools.
        if self.is_attachment_topic:
            self._attachments_pool: MultiprocessingPool | None = MultiprocessingPool(num_processes)
        else:
            self._attachments_pool = None
        if num_processes > 1:
            self.multi_process = MultiProcessConfig(
                num_processes, max_batch_size, max_batch_time, input_block_size, output_block_size
            )

        self.health_checker = HealthChecker("ingest")

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        mp = self.multi_process

        final_step = CommitOffsets(commit)

        if not self.is_attachment_topic:
            event_function = partial(process_simple_event_message, consumer_type=self.consumer_type)
            next_step = maybe_multiprocess_step(mp, event_function, final_step, self._pool)
            return create_backpressure_step(health_checker=self.health_checker, next_step=next_step)

        # The `attachments` topic is a bit different, as it allows multiple event types:
        # - `attachment_chunk`: chunks of an attachment
        # - `attachment`: the actual attachment metadata, requires `attachment_chunk`s to be processed.
        # - `event`: an event (fe. with a minidump) that requires `attachment_chunk`s to be processed.
        # - `user_report`: user reports, which are also emitted on this topic.
        # Especially because of the `attachment_chunk` before `event` ordering requirement,
        # we execute this pipeline in multiple steps, to guarantee that `attachment_chunk`s
        # are being handled in a step before the event depending on them is processed in a
        # later step.

        assert self._attachments_pool is not None
        step_2 = maybe_multiprocess_step(
            mp, process_attachments_and_events, final_step, self._attachments_pool
        )
        # This `FilterStep` will skip over processing `None` (aka already handled attachment chunks)
        # in the second step. We filter this here explicitly,
        # to avoid arroyo from needlessly dispatching `None` messages.
        # However its currently not possible to make that `| None` disappear in the type.
        filter_step = FilterStep(function=lambda msg: bool(msg.payload), next_step=step_2)
        # As the steps are defined (and types inferred) in reverse order, we would get a type error here,
        # as `step_1` outputs an `| None`, but the `filter_step` does not mention that in its type,
        # as it is inferred from the `step_2` input type which does not mention `| None`.
        attachment_function = partial(decode_and_process_chunks, consumer_type=self.consumer_type)
        step_1 = maybe_multiprocess_step(
            mp, attachment_function, filter_step, self._pool  # type:ignore
        )

        return create_backpressure_step(health_checker=self.health_checker, next_step=step_1)

    def shutdown(self) -> None:
        self._pool.close()
        if self._attachments_pool:
            self._attachments_pool.close()
