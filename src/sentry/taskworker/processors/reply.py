from __future__ import annotations

import logging
import time
from collections import deque
from collections.abc import Mapping
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import timedelta
from threading import Thread

import grpc
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTask,
)
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.types import Commit, Message, Partition
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_PENDING,
    ActivationResult,
    ExecuteActivationRequest,
    InflightActivation,
    TaskActivation,
)
from sentry_protos.sentry.v1alpha.taskworker_pb2_grpc import WorkerReplyServiceStub

from sentry.taskworker.pending_task_store import get_storage_backend

logger = logging.getLogger("sentry.taskworker.consumer")


class StrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    """Process new work/tasks and deliver tasks to workers."""

    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: int | None,
        output_block_size: int | None,
        storage: str | None,
        worker_addrs: str,
    ) -> None:
        super().__init__()

        # Maximum amount of time tasks are allowed to live in pending task
        # after this time tasks should be deadlettered if they are followed
        # by completed records. Should come from CLI/options
        self.max_pending_timeout = 8 * 60

        # Maximum number of pending inflight activations in the store before backpressure is emitted
        self.max_inflight_activation_in_store = 1000  # make this configurable

        self.pending_task_store = get_storage_backend(storage)
        self.available_stubs = deque(
            [
                WorkerReplyServiceStub(grpc.insecure_channel(worker_addr))
                for worker_addr in worker_addrs.split(",")
            ]
        )
        self.current_connections = set()
        self.__send_thread: Thread | None = None
        self.__shutdown = False

    def shutdown(self):
        super().shutdown()
        self.__shutdown = True
        self.__send_thread = None

    def start_worker_push(self):
        with ThreadPoolExecutor(max_workers=len(self.available_stubs)) as executor:
            logger.info("Starting grpc clients with %s threads", len(self.available_stubs))
            while True:
                if len(self.available_stubs) == 0:
                    done, not_done = wait(self.current_connections, return_when=FIRST_COMPLETED)
                    self.available_stubs.extend([future.result() for future in done])
                    self.current_connections = not_done

                self.current_connections.add(
                    executor.submit(
                        self._dispatch_activation,
                        self.available_stubs.popleft(),
                        self._poll_pending_task(),
                    )
                )

    def _poll_pending_task(self) -> InflightActivation:
        while True:
            inflight_activation = self.pending_task_store.get_pending_task()
            if inflight_activation:
                logger.info("Polled task %s", inflight_activation.activation.id)
                return inflight_activation
            time.sleep(0.5)

    def _dispatch_activation(
        self,
        stub: WorkerReplyServiceStub,
        inflight_activation: InflightActivation,
    ) -> WorkerReplyServiceStub:
        try:
            logger.info(
                "invoke ExecuteActivation for task_id=%s", inflight_activation.activation.id
            )
            execute_response = stub.ExecuteActivation(
                ExecuteActivationRequest(
                    activation=inflight_activation.activation,
                    processing_deadline=inflight_activation.processing_deadline,
                    # TODO with work + reply consumers being separate this will be hard to get
                    # correct.
                    reply_partition=0,
                ),
            )
            if not execute_response.ok:
                logger.error(
                    "Received an error dispatching a task id=%s error=%s",
                    inflight_activation.activation.id,
                    execute_response.error,
                )
        except grpc.RpcError as rpc_error:
            logger.exception(
                "gRPC failed, code: %s, details: %s",
                rpc_error.code(),
                rpc_error.details(),
            )
            self.pending_task_store.set_task_status(
                task_id=inflight_activation.activation.id,
                task_status=TASK_ACTIVATION_STATUS_PENDING,
            )
            self.pending_task_store.set_task_deadline(
                task_id=inflight_activation.activation.id, task_deadline=None
            )
            time.sleep(1)
        return stub

    def create_with_partitions(
        self, commit: Commit, _: Mapping[Partition, int]
    ) -> ProcessingStrategy[KafkaPayload]:
        def process_message(message: Message[KafkaPayload]) -> InflightActivation:
            activation = TaskActivation()
            activation.ParseFromString(message.payload.value)
            ((_partition, offset),) = message.committable.items()

            # TODO this should read from task namespace configuration
            deadletter_at = timezone.now() + timedelta(minutes=10)

            return InflightActivation(
                activation=activation,
                status=TASK_ACTIVATION_STATUS_PENDING,
                offset=offset,
                added_at=Timestamp(seconds=int(time.time())),
                deadletter_at=Timestamp(seconds=int(deadletter_at.timestamp())),
                processing_deadline=None,
            )

        def limit_tasks(
            message: Message[KafkaPayload],
        ) -> KafkaPayload:
            count = self.pending_task_store.count_pending_task()
            if count >= self.max_inflight_activation_in_store:
                # The number of pending inflight activations in the store exceeds the limit.
                # Wait for workers to complete tasks before adding the next offset to the queue.
                logger.info(
                    "Number of inflight activation: %s exceeds the limit: %s. Retrying in 3 seconds",
                    count,
                    self.max_inflight_activation_in_store,
                )
                raise MessageRejected()
            return message.payload

        def do_upkeep(
            message: Message[KafkaPayload],
        ) -> KafkaPayload:
            # Do upkeep tasks after processing replies.
            # We should account for processing lag for replies here.
            self.pending_task_store.handle_processing_deadlines()
            self.pending_task_store.handle_retry_state_tasks()
            self.pending_task_store.handle_deadletter_at()
            self.pending_task_store.handle_failed_tasks()
            self.pending_task_store.remove_completed()

            return message.payload

        def process_combined_message(message: Message[KafkaPayload]) -> None:
            ((partition, _offset),) = message.committable.items()

            # TODO smelling the topics is gross.
            # We could use a message header instead?
            topic = partition.topic
            if topic.name == "hackweek":
                limit_tasks(message)
                activation = process_message(message)
                self.pending_task_store.store([activation])

            if topic.name == "hackweek-reply":
                result = ActivationResult()
                result.ParseFromString(message.payload.value)
                self.pending_task_store.set_task_status(result.task_id, result.status)

                # TODO only do once and a while, perhaps every 5s?
                do_upkeep(message)

        self.__send_thread = Thread(target=self.start_worker_push, daemon=True)
        self.__send_thread.start()

        return RunTask(function=process_combined_message, next_step=CommitOffsets(commit))
