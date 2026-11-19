import time
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime
from time import sleep as real_sleep  # Import before monkeypatch
from typing import Any
from unittest import mock

import orjson
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies.abstract import MessageRejected, ProcessingStrategy
from arroyo.types import BrokerValue, Commit, Message, Partition, Topic

from sentry import options
from sentry.spans.buffer import SpansBuffer
from sentry.spans.buffer_types import FlushedSegment, Span
from sentry.spans.consumers.process.factory import ProcessSpansStrategyFactory
from sentry.spans.consumers.process.flusher import SpanFlusher
from sentry.spans.segment_key import parse_segment_key
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from tests.sentry.spans.test_buffer import DEFAULT_OPTIONS


@override_options(
    {**DEFAULT_OPTIONS, "spans.drop-in-buffer": [], "spans.process-segments.schema-validation": 0.0}
)
@pytest.mark.parametrize("kafka_slice_id", [None, 2])
def test_basic(kafka_slice_id: int | None) -> None:
    # Flush very aggressively to make test pass instantly
    with mock.patch("time.sleep"):
        topic = Topic("test")
        messages: list[tuple[int, KafkaPayload, int]] = []

        fac = ProcessSpansStrategyFactory(
            max_batch_size=1,
            max_batch_time=10,
            num_processes=1,
            input_block_size=None,
            output_block_size=None,
            produce_to_pipe=lambda project_id, payload, dropped: messages.append(
                (project_id, payload, dropped)
            ),
            kafka_slice_id=kafka_slice_id,
        )

        commits = []

        def add_commit(offsets: object, force: bool = False) -> None:
            commits.append(offsets)

        step = fac.create_with_partitions(add_commit, {Partition(topic, 0): 0})

        try:
            step.submit(
                Message(
                    BrokerValue(
                        partition=Partition(topic, 0),
                        offset=1,
                        payload=KafkaPayload(
                            None,
                            orjson.dumps(
                                {
                                    "organization_id": 1,
                                    "project_id": 12,
                                    "span_id": "a" * 16,
                                    "trace_id": "b" * 32,
                                    "start_timestamp": 1699999999.0,
                                    "end_timestamp": 1700000000.0,
                                    "received": 1700000001.0,
                                    "retention_days": 90,
                                    "name": "test-span",
                                    "status": "ok",
                                }
                            ),
                            [],
                        ),
                        timestamp=datetime.now(),
                    )
                )
            )

            step.poll()
            fac._flusher.current_drift.value = 9000  # "advance" our "clock"

            step.poll()
            # Give flusher threads time to process after drift change
            for _ in range(20):
                if messages:
                    break
                step.poll()
                real_sleep(0.1)

            (_, msg, _) = messages[0]

            result = orjson.loads(msg.value)
            assert result.pop("flush_id")
            # The buffered payload is the original raw bytes, enriched by the
            # buffer with the segment id.
            assert result == {
                "spans": [
                    {
                        "attributes": {
                            "sentry.segment.id": {"type": "string", "value": "aaaaaaaaaaaaaaaa"},
                        },
                        "is_segment": True,
                        "organization_id": 1,
                        "project_id": 12,
                        "span_id": "aaaaaaaaaaaaaaaa",
                        "trace_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                        "end_timestamp": 1700000000.0,
                        "start_timestamp": 1699999999.0,
                        "received": 1700000001.0,
                        "retention_days": 90,
                        "name": "test-span",
                        "status": "ok",
                    },
                ],
            }
        finally:
            fac._flusher.join()


@override_options(
    {
        **DEFAULT_OPTIONS,
        "spans.drop-in-buffer": [],
        "spans.process-segments.schema-validation": 0.0,
    }
)
@pytest.mark.parametrize(
    "field_to_set_none",
    ["trace_id", "span_id"],
)
def test_schema_validator_rejects_none_fields(field_to_set_none: str) -> None:
    """Test that schema validator rejects spans with None values in critical fields"""
    with mock.patch("time.sleep"):
        topic = Topic("test")
        messages: list[tuple[int, KafkaPayload, int]] = []

        fac = ProcessSpansStrategyFactory(
            max_batch_size=1,
            max_batch_time=10,
            num_processes=1,
            input_block_size=None,
            output_block_size=None,
            produce_to_pipe=lambda project_id, payload, dropped: messages.append(
                (project_id, payload, dropped)
            ),
        )

        commits = []

        def add_commit(offsets: object, force: bool = False) -> None:
            commits.append(offsets)

        step = fac.create_with_partitions(add_commit, {Partition(topic, 0): 0})
        try:
            span_data = {
                "organization_id": 1,
                "project_id": 12,
                "span_id": "a" * 16,
                "trace_id": "b" * 32,
                "start_timestamp": 1699999999.0,
                "end_timestamp": 1700000000.0,
                "retention_days": 90,
                "received": 1699999999.0,
                "name": "test-span",
                "status": "ok",
                "is_segment": False,
            }
            # Set the field to None
            span_data[field_to_set_none] = None

            step.submit(
                Message(
                    BrokerValue(
                        partition=Partition(topic, 0),
                        offset=1,
                        payload=KafkaPayload(
                            None,
                            orjson.dumps(span_data),
                            [],
                        ),
                        timestamp=datetime.now(),
                    )
                )
            )

            step.poll()
            fac._flusher.current_drift.value = 9000

            for _ in range(20):
                step.poll()
                real_sleep(0.01)

            # The span fails validation and is dropped rather than DLQ'd, so no
            # messages are produced and the offset is still committed.
            assert len(messages) == 0
            assert commits
        finally:
            fac._flusher.join()


@override_options(
    {
        **DEFAULT_OPTIONS,
        "spans.drop-in-buffer": [],
        "spans.process-segments.schema-validation": 0.0,
    }
)
def test_flusher_processes_limit() -> None:
    """Test that flusher respects the max_processes limit"""
    # Flush very aggressively to make test pass instantly
    with mock.patch("time.sleep"):
        topic = Topic("test")
        messages: list[tuple[int, KafkaPayload, int]] = []

        # Create factory with limited flusher processes
        fac = ProcessSpansStrategyFactory(
            max_batch_size=10,
            max_batch_time=10,
            num_processes=1,
            input_block_size=None,
            output_block_size=None,
            flusher_processes=2,  # Limit to 2 processes even if more shards
            produce_to_pipe=lambda project_id, payload, dropped: messages.append(
                (project_id, payload, dropped)
            ),
        )

        commits = []

        def add_commit(offsets: object, force: bool = False) -> None:
            commits.append(offsets)

        # Create with 4 partitions/shards to test process sharing
        partitions = {Partition(topic, i): 0 for i in range(4)}
        fac.create_with_partitions(add_commit, partitions)
        flusher = fac._flusher

        try:
            # Verify that flusher uses at most 2 processes
            assert len(flusher.processes) == 2
            assert flusher.max_processes == 2
            assert flusher.num_processes == 2

            # Verify shards are distributed across processes
            total_shards = sum(len(shards) for shards in flusher.process_to_shards_map.values())
            assert total_shards == 4  # All 4 shards should be assigned
        finally:
            # shutdown flusher thread
            fac._flusher.join()


@django_db_all
@override_options(
    {
        **DEFAULT_OPTIONS,
        "spans.drop-in-buffer": [],
        "spans.process-segments.schema-validation": 0.0,
    }
)
@pytest.mark.parametrize("kafka_slice_id", [None, 2])
def test_produce_to_kafka_exception(kafka_slice_id: int | None) -> None:
    # Flush very aggressively to make test pass instantly
    with (
        mock.patch("time.sleep"),
    ):
        topic = Topic("test")
        messages: list[tuple[int, KafkaPayload, int]] = []

        def produce_to_pipe(project_id: int, payload: KafkaPayload, dropped: int) -> None:
            raise Exception("Kafka exception")

        fac = ProcessSpansStrategyFactory(
            max_batch_size=1,
            max_batch_time=10,
            num_processes=1,
            input_block_size=None,
            output_block_size=None,
            produce_to_pipe=produce_to_pipe,
            kafka_slice_id=kafka_slice_id,
        )

        commits = []

        def add_commit(offsets: object, force: bool = False) -> None:
            commits.append(offsets)

        step = fac.create_with_partitions(add_commit, {Partition(topic, 0): 0})

        try:
            step.submit(
                Message(
                    BrokerValue(
                        partition=Partition(topic, 0),
                        offset=1,
                        payload=KafkaPayload(
                            None,
                            orjson.dumps(
                                {
                                    "organization_id": 1,
                                    "project_id": 12,
                                    "span_id": "a" * 16,
                                    "trace_id": "b" * 32,
                                    "start_timestamp": 1699999999.0,
                                    "end_timestamp": 1700000000.0,
                                    "received": 1700000001.0,
                                    "retention_days": 90,
                                    "name": "test-span",
                                    "status": "ok",
                                }
                            ),
                            [],
                        ),
                        timestamp=datetime.now(),
                    )
                )
            )

            step.poll()
            fac._flusher.current_drift.value = 9000  # "advance" our "clock"

            step.poll()
            # Give flusher threads time to process after drift change
            for _ in range(20):
                step.poll()
                real_sleep(0.1)
        finally:
            fac._flusher.terminate()
            fac._flusher.join()

    assert len(messages) == 0


_HOLD_PROJECT_ID = 999_011


def _hold_test_buffer() -> SpansBuffer:
    buffer = SpansBuffer(assigned_shards=[0], slice_id=_HOLD_PROJECT_ID)
    keys = buffer.client.keys(f"*{_HOLD_PROJECT_ID}*")
    if keys:
        buffer.client.delete(*keys)
    return buffer


def _hold_test_segment(buffer: SpansBuffer, trace_char: str, deadline: int) -> None:
    span_id = trace_char * 16
    buffer.process_spans(
        [
            Span(
                payload=orjson.dumps({"span_id": span_id, "trace_id": trace_char * 32}),
                trace_id=trace_char * 32,
                span_id=span_id,
                parent_span_id=None,
                segment_id=None,
                project_id=_HOLD_PROJECT_ID,
                is_segment_span=True,
            )
        ],
        # Root segments are due root-timeout seconds after their last span.
        now=deadline - 10,
    )


def _hold_test_message(offset: int, trace_id: str, timestamp: float) -> Message[KafkaPayload]:
    return Message(
        BrokerValue(
            partition=Partition(Topic("test"), 0),
            offset=offset,
            payload=KafkaPayload(
                None,
                orjson.dumps(
                    {
                        "organization_id": 1,
                        "project_id": _HOLD_PROJECT_ID,
                        "span_id": trace_id[:16],
                        "trace_id": trace_id,
                        "start_timestamp": 1699999999.0,
                        "end_timestamp": 1700000000.0,
                        "received": 1700000001.0,
                        "retention_days": 90,
                        "name": "test-span",
                        "status": "ok",
                    }
                ),
                [],
            ),
            timestamp=datetime.fromtimestamp(timestamp),
        )
    )


def _hold_test_traces(buffer: SpansBuffer) -> set[str]:
    """The first character of the trace ID of every segment in Redis."""
    return {
        parse_segment_key(key)[1].decode()[0]
        for key in buffer.client.zrange(buffer.store.get_queue_key(0), 0, -1)
    }


def _record_commits(commits: list[Mapping[Partition, int]]) -> Commit:
    def add_commit(offsets: Mapping[Partition, int], force: bool = False) -> None:
        # CommitOffsets.poll() also commits nothing, to commit periodically.
        if offsets:
            commits.append(offsets)

    return add_commit


def _consume(
    step: ProcessingStrategy[KafkaPayload],
    messages: Sequence[Message[KafkaPayload]],
    until: Callable[[], bool],
    timeout: float = 20,
) -> None:
    """Submit messages like arroyo's StreamProcessor: retry a rejected message, poll in between."""
    pending = list(messages)
    deadline = time.monotonic() + timeout
    while not until() and time.monotonic() < deadline:
        if pending:
            try:
                step.submit(pending[0])
                pending.pop(0)
            except MessageRejected:
                pass
        step.poll()
        real_sleep(0.01)


@override_options(
    {
        **DEFAULT_OPTIONS,
        "spans.drop-in-buffer": [],
        "spans.process-segments.schema-validation": 0.0,
        "spans.buffer.flusher.wait-for-drift-seconds": 60,
    }
)
def test_consumer_holds_first_batch_until_first_flush_cycle() -> None:
    buffer = _hold_test_buffer()
    now = int(time.time())
    # The consumer resumes 300 seconds behind. Segment "a" was due before
    # that. Segment "b" is due by wall-clock time, but not yet by the time of
    # the backlog, so it may still receive spans from it.
    message_time = now - 300
    _hold_test_segment(buffer, "a", deadline=message_time - 100)
    _hold_test_segment(buffer, "b", deadline=now - 100)
    produced: list[str] = []
    batch_written_when_produced: list[bool] = []

    def produce_to_pipe(project_id: int, payload: KafkaPayload, dropped: int) -> None:
        produced.append(orjson.loads(payload.value)["spans"][0]["trace_id"][0])
        batch_written_when_produced.append("c" in _hold_test_traces(buffer))

    fac = ProcessSpansStrategyFactory(
        max_batch_size=1,
        max_batch_time=10,
        num_processes=1,
        input_block_size=None,
        output_block_size=None,
        produce_to_pipe=produce_to_pipe,
        kafka_slice_id=_HOLD_PROJECT_ID,
    )
    commits: list[Mapping[Partition, int]] = []
    step = fac.create_with_partitions(_record_commits(commits), {Partition(Topic("test"), 0): 0})
    try:
        _consume(
            step,
            [_hold_test_message(1, "c" * 32, message_time)],
            until=lambda: bool(commits),
        )

        # The first flush cycle used the drift of the held batch, and finished
        # before the batch was written into Redis and committed.
        assert produced == ["a"]
        assert batch_written_when_produced == [False]
        assert _hold_test_traces(buffer) == {"b", "c"}
        assert commits == [{Partition(Topic("test"), 0): 2}]
        assert fac._flusher.current_drift.value == pytest.approx(message_time - now, abs=5)
    finally:
        fac._flusher.join()
        _hold_test_buffer()


@pytest.mark.parametrize(
    ("wait_for_drift_seconds", "error"),
    [(0, "exited during startup"), (60, "exited before its first flush cycle")],
    ids=["disabled", "enabled"],
)
# The flusher threads' exceptions are expected.
@pytest.mark.filterwarnings("ignore::pytest.PytestUnhandledThreadExceptionWarning")
@override_options(
    {**DEFAULT_OPTIONS, "spans.drop-in-buffer": [], "spans.process-segments.schema-validation": 0.0}
)
def test_consumer_does_not_write_if_first_flush_cycle_fails(
    wait_for_drift_seconds: int, error: str
) -> None:
    # A due segment that a previous consumer left in Redis has a payload
    # member that is not JSON, so every flush cycle that loads it fails.
    buffer = _hold_test_buffer()
    now = int(time.time())
    _hold_test_segment(buffer, "a", deadline=now - 100)
    [payload_key] = buffer.store.load_payload_keys(
        [f"span-buf:s:{{{_HOLD_PROJECT_ID}:{'a' * 32}}}:{'a' * 16}".encode()]
    ).popitem()[1]
    buffer.client.sadd(payload_key, b"not json")

    fac = ProcessSpansStrategyFactory(
        max_batch_size=1,
        max_batch_time=10,
        num_processes=1,
        input_block_size=None,
        output_block_size=None,
        produce_to_pipe=lambda project_id, payload, dropped: None,
        kafka_slice_id=_HOLD_PROJECT_ID,
    )
    commits: list[Mapping[Partition, int]] = []
    try:
        with (
            override_options(
                {"spans.buffer.flusher.wait-for-drift-seconds": wait_for_drift_seconds}
            ),
            pytest.raises(RuntimeError) as excinfo,
        ):
            step = fac.create_with_partitions(
                _record_commits(commits), {Partition(Topic("test"), 0): 0}
            )
            _consume(
                step,
                [_hold_test_message(i, f"b{i:031x}", now) for i in range(100)],
                until=lambda: False,
            )

        # The consumer stopped before it wrote any span into Redis or
        # committed any offset.
        assert _hold_test_traces(buffer) == {"a"}
        assert commits == []
        excinfo.match(f"process 0 \\(shards \\[0\\]\\) {error}")
    finally:
        if hasattr(fac, "_flusher"):
            fac._flusher.join()
        _hold_test_buffer()


@pytest.mark.parametrize(
    ("target", "attribute"),
    [(FlushedSegment, "to_messages"), (SpansBuffer, "done_flush_segments")],
    ids=["to_messages", "done_flush_segments"],
)
# The flusher threads' exceptions are expected.
@pytest.mark.filterwarnings("ignore::pytest.PytestUnhandledThreadExceptionWarning")
@override_options(
    {
        **DEFAULT_OPTIONS,
        "spans.drop-in-buffer": [],
        "spans.process-segments.schema-validation": 0.0,
        "spans.buffer.flusher.wait-for-drift-seconds": 60,
    }
)
def test_consumer_does_not_write_if_first_flush_cycle_fails_after_flush_segments(
    target: type, attribute: str
) -> None:
    # The first flush cycle loads and builds the due segment, and then fails
    # while it produces it or cleans it up.
    buffer = _hold_test_buffer()
    now = int(time.time())
    _hold_test_segment(buffer, "a", deadline=now - 100)

    fac = ProcessSpansStrategyFactory(
        max_batch_size=1,
        max_batch_time=10,
        num_processes=1,
        input_block_size=None,
        output_block_size=None,
        produce_to_pipe=lambda project_id, payload, dropped: None,
        kafka_slice_id=_HOLD_PROJECT_ID,
    )
    commits: list[Mapping[Partition, int]] = []
    try:
        with (
            mock.patch.object(target, attribute, side_effect=ValueError("first cycle fails")),
            pytest.raises(RuntimeError) as excinfo,
        ):
            step = fac.create_with_partitions(
                _record_commits(commits), {Partition(Topic("test"), 0): 0}
            )
            _consume(
                step,
                [_hold_test_message(i, f"b{i:031x}", now) for i in range(100)],
                until=lambda: False,
            )

        # The consumer stopped before it wrote any span into Redis or
        # committed any offset.
        assert _hold_test_traces(buffer) == {"a"}
        assert commits == []
        excinfo.match("process 0 \\(shards \\[0\\]\\) exited before its first flush cycle")
    finally:
        if hasattr(fac, "_flusher"):
            fac._flusher.join()
        _hold_test_buffer()


@pytest.mark.parametrize("wait_for_drift_seconds", [0, 60], ids=["disabled", "enabled"])
@override_options(
    {**DEFAULT_OPTIONS, "spans.drop-in-buffer": [], "spans.process-segments.schema-validation": 0.0}
)
def test_consumer_holds_first_batch_only_when_waiting_for_drift(
    wait_for_drift_seconds: int,
) -> None:
    _hold_test_buffer()
    original = SpanFlusher.hold_first_batch
    fac = ProcessSpansStrategyFactory(
        max_batch_size=1,
        max_batch_time=10,
        num_processes=1,
        input_block_size=None,
        output_block_size=None,
        produce_to_pipe=lambda project_id, payload, dropped: None,
        kafka_slice_id=_HOLD_PROJECT_ID,
    )
    commits: list[Mapping[Partition, int]] = []
    try:
        with (
            override_options(
                {"spans.buffer.flusher.wait-for-drift-seconds": wait_for_drift_seconds}
            ),
            mock.patch.object(
                SpanFlusher, "hold_first_batch", autospec=True, side_effect=original
            ) as hold,
        ):
            step = fac.create_with_partitions(
                _record_commits(commits), {Partition(Topic("test"), 0): 0}
            )
            _consume(
                step,
                [_hold_test_message(1, "c" * 32, time.time())],
                until=lambda: bool(commits),
            )

        assert commits == [{Partition(Topic("test"), 0): 2}]
        # With the option at 0, the factory does not add the step that holds
        # the first batch.
        assert hold.called == (wait_for_drift_seconds > 0)
    finally:
        if hasattr(fac, "_flusher"):
            fac._flusher.join()
        _hold_test_buffer()


@override_options(
    {
        **DEFAULT_OPTIONS,
        "spans.drop-in-buffer": [],
        "spans.process-segments.schema-validation": 0.0,
        "spans.buffer.flusher.wait-for-drift-seconds": 60,
    }
)
def test_consumer_reads_wait_for_drift_once() -> None:
    # Each process has its own options cache. Right after the option is
    # raised, a consumer that still read 0 would not hold the first batch
    # while its new flusher processes, which read the new value, wait for the
    # drift. So SpanFlusher.__init__ reads the option once, for the processes
    # and for the hold. Here the option changes to 0 right after that read.
    _hold_test_buffer()
    get = options.get
    reads: list[int] = []

    def get_option(key: str, *args: Any, **kwargs: Any) -> Any:
        value = get(key, *args, **kwargs)
        if key == "spans.buffer.flusher.wait-for-drift-seconds":
            reads.append(value)
            if len(reads) > 1:
                return 0
        return value

    original = SpanFlusher.hold_first_batch
    fac = ProcessSpansStrategyFactory(
        max_batch_size=1,
        max_batch_time=10,
        num_processes=1,
        input_block_size=None,
        output_block_size=None,
        produce_to_pipe=lambda project_id, payload, dropped: None,
        kafka_slice_id=_HOLD_PROJECT_ID,
    )
    commits: list[Mapping[Partition, int]] = []
    try:
        with (
            mock.patch.object(options, "get", side_effect=get_option),
            mock.patch.object(
                SpanFlusher, "hold_first_batch", autospec=True, side_effect=original
            ) as hold,
        ):
            step = fac.create_with_partitions(
                _record_commits(commits), {Partition(Topic("test"), 0): 0}
            )
            _consume(
                step,
                [_hold_test_message(1, "c" * 32, time.time())],
                until=lambda: bool(commits),
            )

        assert reads == [60]
        assert fac._flusher.wait_for_drift_seconds == 60
        assert hold.called
        assert commits == [{Partition(Topic("test"), 0): 2}]
    finally:
        if hasattr(fac, "_flusher"):
            fac._flusher.join()
        _hold_test_buffer()
