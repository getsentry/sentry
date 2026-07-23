import time
from concurrent.futures import Future
from time import sleep
from types import SimpleNamespace
from typing import Any
from unittest import mock

import orjson
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies.noop import Noop
from django.test import override_settings

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.buffer import SpansBuffer
from sentry.spans.buffer_types import Span
from sentry.spans.consumers.process.flusher import MultiProducer, SpanFlusher
from sentry.testutils.helpers.options import override_options
from tests.sentry.spans.test_buffer import DEFAULT_OPTIONS


def _payload(span_id: str) -> bytes:
    return orjson.dumps({"span_id": span_id})


def _buffer_with_segment(
    *,
    project_id: int = 999_002,
    trace_id: str = "9" * 32,
    span_id: str = "b" * 16,
    slice_id: int = 999_002,
) -> SpansBuffer:
    buffer = SpansBuffer(assigned_shards=[0], slice_id=slice_id)
    buffer.process_spans(
        [
            Span(
                payload=_payload(span_id),
                trace_id=trace_id,
                span_id=span_id,
                parent_span_id=None,
                segment_id=None,
                is_segment_span=True,
                project_id=project_id,
                partition=0,
            )
        ],
        now=0,
    )
    return buffer


def _blocking_main_for_join_test(
    buffer, shards, stopped, current_drift, backpressure_since, healthy_since, produce_to_pipe
):
    """Module-level function for multiprocessing (must be picklable)."""
    healthy_since.value = int(time.time())
    # Block ignoring stopped to simulate stuck I/O (e.g., blocked on Kafka produce)
    while True:
        sleep(0.1)


@override_options({**DEFAULT_OPTIONS, "spans.buffer.flusher.log-flushed-segments": True})
def test_flusher_logs_flushed_segments() -> None:
    project_id = 999_002
    trace_id = "9" * 32
    span_id = "b" * 16
    slice_id = 999_002
    segment_key = f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode()
    queue_key = f"span-buf:q:{slice_id}-0".encode()
    buffer = _buffer_with_segment(
        project_id=project_id, trace_id=trace_id, span_id=span_id, slice_id=slice_id
    )
    stopped = SimpleNamespace(value=0)
    current_drift = SimpleNamespace(value=0)
    backpressure_since = SimpleNamespace(value=0)
    healthy_since = SimpleNamespace(value=0)
    produced: list[tuple[int, Any, int]] = []

    def produce_to_pipe(project_id: int, payload: Any, dropped: int) -> None:
        produced.append((project_id, payload, dropped))
        stopped.value = 1

    with mock.patch("sentry.spans.consumers.process.flusher.logger") as mock_logger:
        SpanFlusher.main(
            buffer,
            shards=[0],
            stopped=stopped,
            current_drift=current_drift,
            backpressure_since=backpressure_since,
            healthy_since=healthy_since,
            produce_to_pipe=produce_to_pipe,
        )

    mock_logger.info.assert_any_call(
        "spans.buffer.flushed_segment",
        extra={
            "segment_key": segment_key.decode("utf-8"),
            "queue_key": queue_key.decode("utf-8"),
            "span_count": 1,
            "project_id": project_id,
        },
    )
    assert len(produced) == 1
    assert produced[0][0] == project_id
    assert produced[0][2] == 1
    assert orjson.loads(produced[0][1].value)["spans"][0]["span_id"] == span_id
    assert buffer.client.zscore(queue_key, segment_key) is None
    assert not buffer.client.keys(f"*{project_id}:{trace_id}*")


@override_options({**DEFAULT_OPTIONS, "spans.buffer.process-segments-task-rollout-rate": 0.0})
def test_flusher_produces_flushed_segments_to_buffered_segments_topic() -> None:
    span_id = "b" * 16
    buffer = _buffer_with_segment(span_id=span_id)
    stopped = SimpleNamespace(value=0)
    current_drift = SimpleNamespace(value=0)
    backpressure_since = SimpleNamespace(value=0)
    healthy_since = SimpleNamespace(value=0)
    produced_payloads: list[KafkaPayload] = []
    producer_future: Future[None] = Future()
    producer_future.set_result(None)
    producer_manager = mock.Mock()

    def produce(payload: KafkaPayload) -> Future[None]:
        produced_payloads.append(payload)
        stopped.value = 1
        return producer_future

    producer_manager.produce.side_effect = produce

    with (
        mock.patch(
            "sentry.spans.consumers.process.flusher.MultiProducer",
            return_value=producer_manager,
        ) as mock_multi_producer,
        mock.patch(
            "sentry.spans.consumers.process.flusher.process_segment_task.apply_async_with_future"
        ) as mock_apply_async_with_future,
    ):
        SpanFlusher.main(
            buffer,
            shards=[0],
            stopped=stopped,
            current_drift=current_drift,
            backpressure_since=backpressure_since,
            healthy_since=healthy_since,
            produce_to_pipe=None,
        )

    mock_multi_producer.assert_called_once_with(Topic.BUFFERED_SEGMENTS)
    mock_apply_async_with_future.assert_not_called()
    assert len(produced_payloads) == 1
    assert orjson.loads(produced_payloads[0].value)["spans"][0]["span_id"] == span_id


@override_options({**DEFAULT_OPTIONS, "spans.buffer.process-segments-task-rollout-rate": 1.0})
def test_flusher_produces_flushed_segments_to_process_segment_task() -> None:
    project_id = 999_002
    trace_id = "9" * 32
    span_id = "c" * 16
    slice_id = 999_002
    segment_key = f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode()
    queue_key = f"span-buf:q:{slice_id}-0".encode()
    buffer = _buffer_with_segment(
        project_id=project_id, trace_id=trace_id, span_id=span_id, slice_id=slice_id
    )
    stopped = SimpleNamespace(value=0)
    current_drift = SimpleNamespace(value=0)
    backpressure_since = SimpleNamespace(value=0)
    healthy_since = SimpleNamespace(value=0)
    producer_manager = mock.Mock()
    task_future = mock.Mock()

    def wait_for_task_delivery() -> None:
        assert buffer.client.zscore(queue_key, segment_key) is not None

    task_future.result.side_effect = wait_for_task_delivery

    def apply_async_with_future(*args: Any, **kwargs: Any) -> Any:
        stopped.value = 1
        return task_future

    with (
        mock.patch(
            "sentry.spans.consumers.process.flusher.MultiProducer",
            return_value=producer_manager,
        ) as mock_multi_producer,
        mock.patch(
            "sentry.spans.consumers.process.flusher.process_segment_task.apply_async_with_future",
            side_effect=apply_async_with_future,
        ) as mock_apply_async_with_future,
    ):
        SpanFlusher.main(
            buffer,
            shards=[0],
            stopped=stopped,
            current_drift=current_drift,
            backpressure_since=backpressure_since,
            healthy_since=healthy_since,
            produce_to_pipe=None,
        )

    mock_multi_producer.assert_called_once_with(Topic.BUFFERED_SEGMENTS)
    producer_manager.produce.assert_not_called()
    mock_apply_async_with_future.assert_called_once()
    task_args = mock_apply_async_with_future.call_args.kwargs["args"]
    task_headers = mock_apply_async_with_future.call_args.kwargs["headers"]
    assert len(task_args) == 1
    assert orjson.loads(task_args[0])["spans"][0]["span_id"] == span_id
    assert task_headers == {"sentry-propagate-traces": False}
    task_future.result.assert_called_once_with()
    assert buffer.client.zscore(queue_key, segment_key) is None


@override_options({**DEFAULT_OPTIONS, "spans.buffer.max-flush-segments": 1})
def test_backpressure() -> None:
    # Flush very aggressively to make join() faster
    with mock.patch("time.sleep"):
        messages = []

        def append(msg):
            messages.append(msg)
            sleep(1.0)

        buffer = SpansBuffer(assigned_shards=list(range(1)))
        flusher = SpanFlusher(
            buffer,
            next_step=Noop(),
            produce_to_pipe=lambda project_id, payload, dropped: append(
                (project_id, payload, dropped)
            ),
        )

        try:
            now = time.time()

            for i in range(200):
                trace_id = f"{i:0>32x}"

                spans = [
                    Span(
                        payload=_payload("a" * 16),
                        trace_id=trace_id,
                        span_id="a" * 16,
                        parent_span_id="b" * 16,
                        segment_id=None,
                        project_id=1,
                    ),
                    Span(
                        payload=_payload("d" * 16),
                        trace_id=trace_id,
                        span_id="d" * 16,
                        parent_span_id="b" * 16,
                        segment_id=None,
                        project_id=1,
                    ),
                    Span(
                        payload=_payload("c" * 16),
                        trace_id=trace_id,
                        span_id="c" * 16,
                        parent_span_id="b" * 16,
                        segment_id=None,
                        project_id=1,
                    ),
                    Span(
                        payload=_payload("b" * 16),
                        trace_id=trace_id,
                        span_id="b" * 16,
                        parent_span_id=None,
                        is_segment_span=True,
                        segment_id=None,
                        project_id=1,
                    ),
                ]

                buffer.process_spans(spans, now=int(now))

            # Advance drift to trigger idle timeout of all segments. The flusher should
            # have way too much to do due to `max_flush_segments=1` and enter
            # backpressure state.

            flusher.current_drift.value = 20000
            sleep(0.1)

            assert messages

            assert any(x.value for x in flusher.process_backpressure_since.values())
        finally:
            flusher.join()


def create_memory_producer_factory():
    """Create a factory that returns in-memory LocalProducers from Arroyo."""
    from arroyo.backends.local.backend import LocalBroker
    from arroyo.backends.local.storages.memory import MemoryMessageStorage

    # Create shared storage so we can inspect messages across producers
    storage = MemoryMessageStorage[Any]()
    broker = LocalBroker(storage)

    def producer_factory(producer_config):
        return broker.get_producer()

    # Return both factory and storage for inspection
    return broker, producer_factory, storage


@override_settings(
    SLICED_KAFKA_TOPICS={
        ("buffered-segments", 0): {"cluster": "default", "topic": "buffered-segments-1"},
        ("buffered-segments", 1): {"cluster": "default", "topic": "buffered-segments-2"},
    }
)
def test_multi_producer_sliced_integration_with_arroyo_local_producer() -> None:
    from arroyo import Topic as ArroyoTopic
    from arroyo.backends.kafka import KafkaPayload

    broker, producer_factory, storage = create_memory_producer_factory()
    broker.create_topic(ArroyoTopic("buffered-segments-1"), partitions=1)
    broker.create_topic(ArroyoTopic("buffered-segments-2"), partitions=1)

    manager = MultiProducer(Topic.BUFFERED_SEGMENTS, producer_factory=producer_factory)

    assert len(manager.producers) == 2
    assert len(manager.topics) == 2

    topic_names = [topic.name for topic in manager.topics]
    assert "buffered-segments-1" in topic_names
    assert "buffered-segments-2" in topic_names

    payload1 = KafkaPayload(None, b"test-message-1", [])
    payload2 = KafkaPayload(None, b"test-message-2", [])
    payload3 = KafkaPayload(None, b"test-message-3", [])

    manager.produce(payload1)
    manager.produce(payload2)
    manager.produce(payload3)

    from arroyo import Partition

    topic1_partition = Partition(ArroyoTopic("buffered-segments-1"), 0)
    topic2_partition = Partition(ArroyoTopic("buffered-segments-2"), 0)

    message1 = broker.consume(topic1_partition, 0)
    message2 = broker.consume(topic2_partition, 0)
    message3 = broker.consume(topic1_partition, 1)

    assert message1 is not None
    assert message2 is not None
    assert message3 is not None

    assert message1.payload.value == b"test-message-1"
    assert message2.payload.value == b"test-message-2"
    assert message3.payload.value == b"test-message-3"

    manager.close()


def test_flusher_waits_for_exited_processes_during_startup() -> None:
    """Test that the flusher waits for all processes to become healthy during initialization."""
    buffer = SpansBuffer(assigned_shards=[0])

    # exit without setting healthy_since, simulating a process that fails early
    def never_healthy_main(
        buffer, shards, stopped, current_drift, backpressure_since, healthy_since, produce_to_pipe
    ):
        return

    with (
        mock.patch.object(SpanFlusher, "main", never_healthy_main),
        override_options(
            {
                "spans.buffer.flusher.max-unhealthy-seconds": 0.5,
                "spans.buffer.flusher.use-stuck-detector": False,
            }
        ),
        pytest.raises(RuntimeError, match="process 0 \\(shards \\[0\\]\\) exited during startup"),
    ):
        SpanFlusher(
            buffer,
            next_step=Noop(),
            produce_to_pipe=lambda project_id, payload, dropped: None,
        )


def test_flusher_timeout_waiting_for_processes_startup() -> None:
    """Test that the flusher times out when a process stays alive but never becomes healthy."""
    buffer = SpansBuffer(assigned_shards=[0])

    # block without setting healthy_since, simulating a process that hangs during startup
    def hang_main(
        buffer, shards, stopped, current_drift, backpressure_since, healthy_since, produce_to_pipe
    ):
        while not stopped.value:
            sleep(0.05)

    with (
        mock.patch.object(SpanFlusher, "main", hang_main),
        override_options(
            {
                "spans.buffer.flusher.max-unhealthy-seconds": 0.5,
                "spans.buffer.flusher.use-stuck-detector": False,
            }
        ),
        pytest.raises(RuntimeError, match="process 0 \\(shards \\[0\\]\\) didn't start up"),
    ):
        SpanFlusher(
            buffer,
            next_step=Noop(),
            produce_to_pipe=lambda project_id, payload, dropped: None,
        )


def test_flusher_join_timeout_kills_all_processes() -> None:
    """Test that all flusher processes are killed even if join times out.

    Reproduces a bug where hitting the join timeout would break out of the loop
    early, without calling kill() on remaining processes.
    """
    import multiprocessing
    import multiprocessing.process

    buffer = SpansBuffer(assigned_shards=[0, 1, 2])

    # Track which process indices had kill() called
    kill_called_for: set[int] = set()
    flusher: SpanFlusher | None = None  # Will be set below, needed for patched_kill closure

    # Patch BaseProcess.kill to track calls (SpawnProcess inherits from this)
    original_kill = multiprocessing.process.BaseProcess.kill

    def patched_kill(self):
        # Find which process_index this is
        if flusher is not None:
            for idx, proc in flusher.processes.items():
                if proc is self:
                    kill_called_for.add(idx)
                    break
        return original_kill(self)

    with (
        mock.patch.object(SpanFlusher, "main", _blocking_main_for_join_test),
        mock.patch.object(multiprocessing.process.BaseProcess, "kill", patched_kill),
        override_options(
            {
                "spans.buffer.flusher.max-unhealthy-seconds": 10,
                "spans.buffer.flusher.use-stuck-detector": False,
            }
        ),
    ):
        # Don't use produce_to_pipe so we get real multiprocessing.Process instances
        flusher = SpanFlusher(
            buffer,
            next_step=Noop(),
            max_processes=3,
        )

        try:
            assert len(flusher.processes) == 3
            for process in flusher.processes.values():
                assert process.is_alive()

            # With 0.01s timeout, next_step.join() consumes it, then we should still
            # iterate through ALL processes and call kill() on each
            flusher.join(timeout=0.01)

            # EXPECTED: kill() should be called on all 3 processes
            assert kill_called_for == {0, 1, 2}, (
                f"kill() should be called on all processes, "
                f"but was only called on: {kill_called_for}"
            )
        finally:
            # Clean up: forcibly kill any leaked processes
            for process in flusher.processes.values():
                assert isinstance(process, multiprocessing.process.BaseProcess)
                if process.is_alive():
                    original_kill(process)
