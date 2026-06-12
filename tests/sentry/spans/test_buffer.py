from __future__ import annotations

import itertools
from collections.abc import Sequence
from typing import cast
from unittest import mock

import orjson
import pytest
import sentry_kafka_schemas
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.constants import DataCategory
from sentry.spans.buffer import SpansBuffer
from sentry.spans.buffer_types import (
    EvalshaResult,
    FlushCandidate,
    FlushedSegment,
    InsertedSubsegment,
    LoadedSegment,
    OutputSpan,
    SegmentIngestMetadata,
    Span,
    Subsegment,
)
from sentry.spans.consumers.process.factory import SPANS_CODEC, validate_span_event
from sentry.spans.consumers.process_segments.types import attribute_value
from sentry.spans.segment_key import SegmentKey
from sentry.testutils.helpers.options import override_options
from sentry.utils.outcomes import Outcome

pytestmark = [pytest.mark.django_db]

DEFAULT_OPTIONS = {
    "spans.buffer.timeout": 60,
    "spans.buffer.root-timeout": 10,
    "spans.buffer.segment-page-size": 100,
    "spans.buffer.max-segment-bytes": 10 * 1024 * 1024,
    "spans.buffer.redis-ttl": 3600,
    "spans.buffer.max-flush-segments": 500,
    "spans.buffer.max-memory-percentage": 1.0,
    "spans.buffer.flusher.backpressure-seconds": 10,
    "spans.buffer.flusher.max-unhealthy-seconds": 60,
    "spans.buffer.flusher.use-stuck-detector": False,
    "spans.buffer.flusher.flush-lock-ttl": 0,
    "spans.buffer.ensure-script.skip-exists-check": True,
    "spans.buffer.flusher-cumulative-logger-enabled": False,
    "spans.buffer.flusher.log-flushed-segments": False,
    "spans.buffer.compression.level": 0,
    "spans.buffer.pipeline-batch-size": 0,
    "spans.buffer.max-spans-per-evalsha": 0,
    "spans.buffer.evalsha-latency-threshold": 100,
    "spans.buffer.evalsha-cumulative-logger-enabled": True,
    "spans.buffer.debug-traces": [],
    "spans.process-segments.schema-validation": 1.0,
}


def shallow_permutations(spans: list[Span]) -> list[list[Span]]:
    return [
        spans,
        list(reversed(spans)),
        [span_or_split for span in spans for span_or_split in [span, _SplitBatch()]],  # type: ignore[misc]
    ]


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _payload_key(project_id: int, trace_id: str, salt: str) -> bytes:
    return f"span-buf:s:{{{project_id}:{trace_id}:{salt}}}:{salt}".encode("ascii")


def _payload(span_id: str) -> bytes:
    return orjson.dumps({"span_id": span_id})


def _output_segment(span_id: bytes, segment_id: bytes, is_segment: bool) -> OutputSpan:
    return OutputSpan(
        payload={
            "span_id": span_id.decode("ascii"),
            "is_segment": is_segment,
            "attributes": {
                "sentry.segment.id": {"type": "string", "value": segment_id.decode("ascii")},
            },
        }
    )


def _span(
    span_id: str,
    parent_span_id: str | None,
    *,
    trace_id: str = "a" * 32,
    project_id: int = 1,
    is_segment_span: bool = False,
    partition: int = 0,
) -> Span:
    return Span(
        payload=_payload(span_id),
        trace_id=trace_id,
        span_id=span_id,
        parent_span_id=parent_span_id,
        segment_id=None,
        project_id=project_id,
        is_segment_span=is_segment_span,
        partition=partition,
    )


def _normalize_output(output: dict[SegmentKey, FlushedSegment]):
    for segment in output.values():
        segment.spans.sort(key=lambda span: span.payload["span_id"])


@pytest.fixture(
    params=[
        pytest.param(("cluster", 0), id="cluster-nochunk"),
        pytest.param(("cluster", 1), id="cluster-chunk1"),
        pytest.param(("single", 0), id="single-nochunk"),
        pytest.param(("single", 1), id="single-chunk1"),
    ]
)
def buffer(request):
    redis_type, max_spans_per_evalsha = request.param
    test_options = {
        **DEFAULT_OPTIONS,
        "spans.buffer.max-spans-per-evalsha": max_spans_per_evalsha,
    }
    with override_options(test_options):
        if redis_type == "cluster":
            from sentry.testutils.helpers.redis import use_redis_cluster
            from sentry.utils import redis as redis_utils

            # Use a distinct cluster name to avoid poisoning the "default"
            # entry in RedisClusterManager._clusters_bytes, which would
            # leak a Redis Cluster client into subsequent tests that expect
            # standalone Redis under "default".
            with use_redis_cluster(
                "span-buffer",
                with_settings={"SENTRY_SPAN_BUFFER_CLUSTER": "span-buffer"},
            ):
                buf = SpansBuffer(assigned_shards=list(range(32)))
                buf.client.flushall()
                yield buf
                # Clean up cached client so it doesn't persist after the
                # option override is restored.
                redis_utils.redis_clusters._clusters_bytes.pop("span-buffer", None)
        else:
            buf = SpansBuffer(assigned_shards=list(range(32)))
            buf.client.flushdb()
            yield buf


def assert_ttls(client: StrictRedis[bytes] | RedisCluster[bytes]):
    """
    Check that all keys have a TTL, because if the consumer dies before
    flushing, we should not leak memory.
    """

    for k in client.keys("*"):
        assert client.ttl(k) > -1, k


def assert_clean(client: StrictRedis[bytes] | RedisCluster[bytes]):
    """
    Check that there's no leakage.

    Note: CANNOT be done in pytest fixture as that one runs _after_ redis gets
    wiped by the test harness.
    """
    assert not [x for x in client.keys("*") if b":hrs:" not in x]


class _SplitBatch:
    pass


def process_spans(spans: Sequence[Span | _SplitBatch], buffer: SpansBuffer, now):
    """
    Call buffer.process_spans on the list of spans.

    We get a sequence of spans like this:

        A
        B
        C
        SPLIT
        D

    A, B, C will land in a batch, D will land in its own batch.
    """

    span_chunks: list[list[Span]] = [[]]

    for span in spans:
        if isinstance(span, _SplitBatch):
            if span_chunks[-1]:
                span_chunks.append([])
        else:
            span_chunks[-1].append(span)

    for chunk in span_chunks:
        buffer.process_spans(chunk, now)


# --- Unit Tests ---


def test_build_subsegments_keeps_parent_metadata_when_chunking() -> None:
    buffer = SpansBuffer(assigned_shards=[0])
    trace_id = "a" * 32
    project_and_trace = f"1:{trace_id}"
    parent_span_id = "f" * 16
    spans = [
        _span("a" * 16, parent_span_id, partition=3),
        _span("b" * 16, parent_span_id, partition=3),
        _span("c" * 16, parent_span_id, partition=3),
    ]

    trees = buffer._group_by_parent(spans)
    subsegments = buffer._build_subsegments(trees, max_spans_per_evalsha=2)
    batches = buffer._batch_subsegments(subsegments, pipeline_batch_size=1)

    assert list(trees) == [(project_and_trace, parent_span_id)]
    assert [subsegment.key for subsegment in subsegments] == [
        (project_and_trace, parent_span_id),
        (project_and_trace, parent_span_id),
    ]
    assert [subsegment.span_ids for subsegment in subsegments] == [
        ["a" * 16, "b" * 16],
        ["c" * 16],
    ]
    assert [[subsegment.parent_span_id for subsegment in batch] for batch in batches] == [
        [parent_span_id],
        [parent_span_id],
    ]


def test_batch_subsegments_groups_by_pipeline_batch_size() -> None:
    buffer = SpansBuffer(assigned_shards=[0])
    trace_id = "a" * 32
    parent_span_id = "f" * 16
    subsegments = [
        Subsegment(
            project_and_trace=f"1:{trace_id}",
            parent_span_id=parent_span_id,
            salt=f"salt-{i}",
            spans=[_span(f"{i}" * 16, parent_span_id)],
        )
        for i in range(3)
    ]

    assert [
        [subsegment.salt for subsegment in batch]
        for batch in buffer._batch_subsegments(subsegments, pipeline_batch_size=2)
    ] == [["salt-0", "salt-1"], ["salt-2"]]
    assert buffer._batch_subsegments(subsegments, pipeline_batch_size=0) == [subsegments]


def test_push_payloads_writes_payloads() -> None:
    buffer = SpansBuffer(assigned_shards=[0])
    client = mock.MagicMock()
    pipeline = mock.MagicMock()
    client.pipeline.return_value.__enter__.return_value = pipeline
    buffer.__dict__["client"] = client

    trace_id = "a" * 32
    project_and_trace = f"1:{trace_id}"
    parent_span_id = "f" * 16
    spans = [
        _span("a" * 16, parent_span_id),
        _span("b" * 16, parent_span_id),
    ]

    with override_options({"spans.buffer.compression.level": -1}):
        trees, subsegment_batches = buffer._push_payloads(
            spans,
            redis_ttl=3600,
            max_spans_per_evalsha=0,
            pipeline_batch_size=0,
        )

    subsegment = subsegment_batches[0][0]
    payload_key = buffer.store.get_payload_key(project_and_trace, subsegment.salt)
    sadd_args = pipeline.sadd.call_args.args
    assert list(trees) == [(project_and_trace, parent_span_id)]
    assert subsegment.spans == spans
    assert sadd_args[0] == payload_key
    assert set(sadd_args[1:]) == {span.payload for span in spans}
    pipeline.expire.assert_called_once_with(payload_key, 3600)
    pipeline.execute.assert_called_once_with()


def test_insert_spans_builds_evalsha_commands_and_results() -> None:
    buffer = SpansBuffer(assigned_shards=[0])
    client = mock.MagicMock()
    pipeline = mock.MagicMock()
    client.pipeline.return_value.__enter__.return_value = pipeline
    buffer.__dict__["client"] = client
    buffer._debug_trace_logger = mock.Mock()
    buffer._buffer_logger = mock.Mock()

    trace_id = "a" * 32
    project_and_trace = f"1:{trace_id}"
    parent_span_id = "f" * 16
    root_span = _span("a" * 16, parent_span_id, is_segment_span=True)
    child_span = _span("b" * 16, parent_span_id)
    root_subsegment = Subsegment(
        project_and_trace=project_and_trace,
        parent_span_id=parent_span_id,
        salt="root-salt",
        spans=[root_span],
    )
    child_subsegment = Subsegment(
        project_and_trace=project_and_trace,
        parent_span_id=parent_span_id,
        salt="child-salt",
        spans=[child_span],
    )
    root_result = [
        _segment_id(1, trace_id, parent_span_id),
        True,
        15,
        [(b"latency", 1.0)],
        [(b"gauge", 2.0)],
    ]
    child_result = [
        _segment_id(1, trace_id, "b" * 16),
        False,
        5,
        [],
        [],
    ]
    pipeline.execute.return_value = [root_result, child_result]

    with (
        mock.patch.object(buffer.store, "ensure_script", return_value="add-buffer-sha"),
        mock.patch("sentry.spans.buffer_logger.emit_observability_metrics") as emit_metrics,
    ):
        inserted_subsegments = buffer._insert_spans(
            [[root_subsegment, child_subsegment]],
            redis_ttl=3600,
            max_segment_bytes=1024,
            flush_lock_ttl=30,
        )

    assert inserted_subsegments == [
        InsertedSubsegment(root_subsegment, EvalshaResult.from_redis_result(root_result)),
        InsertedSubsegment(child_subsegment, EvalshaResult.from_redis_result(child_result)),
    ]
    pipeline.execute_command.assert_has_calls(
        [
            mock.call(
                "EVALSHA",
                "add-buffer-sha",
                1,
                project_and_trace,
                1,
                parent_span_id,
                "true",
                3600,
                len(root_span.payload),
                1024,
                "root-salt",
                "true",
                root_span.span_id,
            ),
            mock.call(
                "EVALSHA",
                "add-buffer-sha",
                1,
                project_and_trace,
                1,
                parent_span_id,
                "false",
                3600,
                len(child_span.payload),
                1024,
                "child-salt",
                "true",
                child_span.span_id,
            ),
        ]
    )
    pipeline.execute.assert_called_once_with()
    buffer._buffer_logger.log.assert_called_once_with(
        [(project_and_trace, 15), (project_and_trace, 5)]
    )
    emit_metrics.assert_called_once_with(
        [[(b"latency", 1.0)], []],
        [[(b"gauge", 2.0)], []],
        (15, [(b"latency", 1.0)], [(b"gauge", 2.0)]),
    )


def test_emit_process_spans_count_metrics() -> None:
    buffer = SpansBuffer(assigned_shards=[0])

    trace_id = "a" * 32
    project_and_trace = f"1:{trace_id}"
    parent_span_id = "f" * 16
    root_span = _span("a" * 16, parent_span_id, is_segment_span=True)
    child_span = _span("b" * 16, parent_span_id)
    subsegment = Subsegment(
        project_and_trace=project_and_trace,
        parent_span_id=parent_span_id,
        salt="salted",
        spans=[root_span, child_span],
    )
    inserted_subsegments = [
        InsertedSubsegment(
            subsegment,
            EvalshaResult(
                segment_key=_segment_id(1, trace_id, parent_span_id),
                has_root_span=True,
                latency_ms=15,
                latency_metrics=[],
                gauge_metrics=[],
            ),
        )
    ]

    with (
        mock.patch("sentry.spans.buffer.metrics.timing") as timing,
        mock.patch("sentry.spans.buffer.metrics.incr") as incr,
    ):
        buffer._emit_process_spans_count_metrics(
            [root_span, child_span],
            {subsegment.key: [root_span, child_span]},
            inserted_subsegments,
        )

    timing.assert_has_calls(
        [
            mock.call("spans.buffer.process_spans.num_spans", 2),
            mock.call("spans.buffer.process_spans.num_is_root_spans", 1),
            mock.call("spans.buffer.process_spans.num_subsegments", 1),
            mock.call("spans.buffer.process_spans.num_evalsha_calls", 1),
        ]
    )
    incr.assert_called_once_with("spans.buffer.process_spans.count_spans", amount=2)


def test_update_queue_uses_inserted_subsegment_metadata() -> None:
    buffer = SpansBuffer(assigned_shards=[0])
    client = mock.MagicMock()
    pipeline = mock.MagicMock()
    client.pipeline.return_value.__enter__.return_value = pipeline
    buffer.__dict__["client"] = client
    debug_trace_logger = mock.Mock()
    debug_trace_logger._should_log_trace.return_value = False
    buffer._debug_trace_logger = debug_trace_logger

    trace_id = "a" * 32
    project_and_trace = f"1:{trace_id}"
    parent_span_id = "f" * 16
    salt = "salted"
    first_span = _span("a" * 16, parent_span_id, partition=3)
    second_span = _span("b" * 16, parent_span_id, partition=3)
    subsegment = Subsegment(
        project_and_trace=project_and_trace,
        parent_span_id=parent_span_id,
        salt=salt,
        spans=[first_span],
    )
    result = EvalshaResult(
        segment_key=_segment_id(1, trace_id, parent_span_id),
        has_root_span=True,
        latency_ms=15,
        latency_metrics=[],
        gauge_metrics=[],
    )

    buffer._update_queue(
        {subsegment.key: [first_span, second_span]},
        [InsertedSubsegment(subsegment, result)],
        now=100,
        redis_ttl=3600,
        timeout=60,
        root_timeout=10,
    )

    queue_key = buffer.store.get_queue_key(3)
    pipeline.zadd.assert_called_once_with(queue_key, {result.segment_key: 110})
    pipeline.expire.assert_called_once_with(queue_key, 3600)
    zrem_args = pipeline.zrem.call_args.args
    assert zrem_args[0] == queue_key
    assert set(zrem_args[1:]) == {
        buffer.store.get_span_key(project_and_trace, first_span.span_id),
        buffer.store.get_span_key(project_and_trace, second_span.span_id),
    }
    pipeline.execute.assert_called_once_with()
    client.zscore.assert_not_called()
    debug_trace_logger.log_deadline_update.assert_called_once_with(
        segment_key=result.segment_key,
        project_and_trace=project_and_trace,
        old_deadline=None,
        new_deadline=110,
        message_timestamp=100,
        has_root_span=True,
    )


# --- Integration / End-to-End Tests ---


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload("a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id=None,
                    segment_id=None,
                    is_segment_span=True,
                    project_id=1,
                ),
            ]
        )
    ),
)
def test_basic(buffer: SpansBuffer, spans) -> None:
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=1,
            spans=[
                _output_segment(b"a" * 16, b"b" * 16, False),
                _output_segment(b"b" * 16, b"b" * 16, True),
                _output_segment(b"c" * 16, b"b" * 16, False),
                _output_segment(b"d" * 16, b"b" * 16, False),
            ],
        )
    }
    buffer.done_flush_segments(rv)
    assert buffer.flush_segments(now=30) == {}

    assert list(buffer.get_memory_info())

    assert_clean(buffer.client)


@mock.patch("sentry.spans.buffer_logger.emit_observability_metrics")
def test_observability_metrics(
    emit_observability_metrics: mock.MagicMock, buffer: SpansBuffer
) -> None:
    spans = [
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
        ),
        Span(
            payload=_payload("d" * 16),
            trace_id="a" * 32,
            span_id="d" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
        ),
        Span(
            payload=_payload("c" * 16),
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
        ),
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id=None,
            segment_id=None,
            is_segment_span=True,
            project_id=1,
        ),
    ]
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=1,
            spans=[
                _output_segment(b"a" * 16, b"b" * 16, False),
                _output_segment(b"b" * 16, b"b" * 16, True),
                _output_segment(b"c" * 16, b"b" * 16, False),
                _output_segment(b"d" * 16, b"b" * 16, False),
            ],
        )
    }
    buffer.done_flush_segments(rv)
    assert buffer.flush_segments(now=30) == {}

    assert list(buffer.get_memory_info())

    assert_clean(buffer.client)
    emit_observability_metrics.assert_called_once()


def test_duplicate_batch_is_idempotent(buffer: SpansBuffer) -> None:
    spans = [
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
        ),
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id=None,
            segment_id=None,
            is_segment_span=True,
            project_id=1,
        ),
    ]

    buffer.process_spans(spans, now=0)
    buffer.process_spans(spans, now=0)

    rv = buffer.flush_segments(now=11)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=1,
            spans=[
                _output_segment(b"a" * 16, b"b" * 16, False),
                _output_segment(b"b" * 16, b"b" * 16, True),
            ],
        )
    }
    buffer.done_flush_segments(rv)
    assert_clean(buffer.client)


def test_flush_segments_with_null_attributes(buffer: SpansBuffer) -> None:
    spans = [
        Span(
            payload=orjson.dumps({"span_id": "b" * 16, "attributes": None}),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id=None,
            segment_id=None,
            is_segment_span=True,
            project_id=1,
        ),
    ]

    process_spans(spans, buffer, now=0)

    rv = buffer.flush_segments(now=11)
    segment = rv[_segment_id(1, "a" * 32, "b" * 16)]
    assert segment.spans[0].payload["attributes"]["sentry.segment.id"]["value"] == "b" * 16


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                _SplitBatch(),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id="a" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="a" * 16,
                    segment_id=None,
                    project_id=1,
                ),
            ]
        )
    ),
)
def test_deep(buffer: SpansBuffer, spans) -> None:
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    rv = buffer.flush_segments(now=10)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=1,
            spans=[
                _output_segment(b"a" * 16, b"a" * 16, True),
                _output_segment(b"b" * 16, b"a" * 16, False),
                _output_segment(b"c" * 16, b"a" * 16, False),
                _output_segment(b"d" * 16, b"a" * 16, False),
            ],
        )
    }

    buffer.done_flush_segments(rv)

    rv = buffer.flush_segments(now=60)
    assert rv == {}

    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload("e" * 16),
                    trace_id="a" * 32,
                    span_id="e" * 16,
                    parent_span_id="d" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id="c" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="a" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    segment_id=None,
                    project_id=1,
                ),
            ]
        )
    ),
)
def test_deep2(buffer: SpansBuffer, spans) -> None:
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    rv = buffer.flush_segments(now=10)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=1,
            spans=[
                _output_segment(b"a" * 16, b"a" * 16, True),
                _output_segment(b"b" * 16, b"a" * 16, False),
                _output_segment(b"c" * 16, b"a" * 16, False),
                _output_segment(b"d" * 16, b"a" * 16, False),
                _output_segment(b"e" * 16, b"a" * 16, False),
            ],
        )
    }

    buffer.done_flush_segments(rv)

    rv = buffer.flush_segments(now=60)
    assert rv == {}

    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("e" * 16),
                    trace_id="a" * 32,
                    span_id="e" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    segment_id=None,
                    project_id=2,
                ),
            ]
        )
    ),
)
def test_parent_in_other_project(buffer: SpansBuffer, spans) -> None:
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    assert rv == {
        _segment_id(2, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=2,
            spans=[_output_segment(b"b" * 16, b"b" * 16, True)],
        )
    }
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == {}
    rv = buffer.flush_segments(now=60)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=1,
            spans=[
                _output_segment(b"c" * 16, b"b" * 16, False),
                _output_segment(b"d" * 16, b"b" * 16, False),
                _output_segment(b"e" * 16, b"b" * 16, False),
            ],
        )
    }
    buffer.done_flush_segments(rv)

    assert buffer.flush_segments(now=90) == {}

    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "spans",
    shallow_permutations(
        [
            Span(
                payload=_payload("c" * 16),
                trace_id="a" * 32,
                span_id="c" * 16,
                parent_span_id="d" * 16,
                project_id=1,
                segment_id=None,
                is_segment_span=True,
            ),
            Span(
                payload=_payload("d" * 16),
                trace_id="a" * 32,
                span_id="d" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
            ),
            Span(
                payload=_payload("e" * 16),
                trace_id="a" * 32,
                span_id="e" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
            ),
            Span(
                payload=_payload("b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                is_segment_span=True,
                segment_id=None,
                project_id=2,
            ),
        ]
    ),
)
def test_parent_in_other_project_and_nested_is_segment_span(buffer: SpansBuffer, spans) -> None:
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    assert rv == {
        _segment_id(2, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=2,
            spans=[_output_segment(b"b" * 16, b"b" * 16, True)],
        ),
        _segment_id(1, "a" * 32, "c" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=1,
            spans=[
                _output_segment(b"c" * 16, b"c" * 16, True),
            ],
        ),
    }
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == {}
    rv = buffer.flush_segments(now=60)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=1,
            spans=[
                _output_segment(b"d" * 16, b"b" * 16, False),
                _output_segment(b"e" * 16, b"b" * 16, False),
            ],
        ),
    }

    buffer.done_flush_segments(rv)

    assert buffer.flush_segments(now=90) == {}

    assert_clean(buffer.client)


def test_flush_rebalance(buffer: SpansBuffer) -> None:
    spans = [
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id=None,
            segment_id=None,
            project_id=1,
            is_segment_span=True,
        )
    ]

    process_spans(spans, buffer, now=0)
    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=1,
            spans=[_output_segment(b"a" * 16, b"a" * 16, True)],
        ),
    }

    # Clear out assigned shards, simulating a rebalance operation.
    buffer.assigned_shards.clear()
    buffer.done_flush_segments(rv)

    rv = buffer.flush_segments(now=20)
    assert not rv

    assert_clean(buffer.client)


@pytest.mark.parametrize("compression_level", [-1, 0])
def test_compression_functionality(compression_level) -> None:
    """Test that compression is working correctly at various compression levels."""
    with override_options({**DEFAULT_OPTIONS, "spans.buffer.compression.level": compression_level}):
        buffer = SpansBuffer(assigned_shards=list(range(32)))

        def make_payload(span_id: str):
            return orjson.dumps(
                {
                    "span_id": span_id,
                    "trace_id": "a" * 32,
                    "data": {"message": "x" * 1000},
                    "extra_data": {"field": "y" * 500},
                }
            )

        spans = [
            Span(
                payload=make_payload("b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                project_id=1,
                segment_id=None,
                is_segment_span=True,
            ),
            Span(
                payload=make_payload("a" * 16),
                trace_id="a" * 32,
                span_id="a" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
            ),
            Span(
                payload=make_payload("c" * 16),
                trace_id="a" * 32,
                span_id="c" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
            ),
        ]

        buffer.process_spans(spans, now=0)

        # Verify payloads are stored in distributed payload keys
        mk_key = b"span-buf:mk:{1:" + b"a" * 32 + b"}:" + b"b" * 16
        payload_span_ids = buffer.client.smembers(mk_key)
        assert len(payload_span_ids) > 0

        segments = buffer.flush_segments(now=11)
        assert len(segments) == 1

        segment = list(segments.values())[0]
        assert len(segment.spans) == 3

        span_ids = set()
        for span in segment.spans:
            assert "data" in span.payload
            assert "extra_data" in span.payload
            assert span.payload["data"]["message"] == "x" * 1000
            assert span.payload["extra_data"]["field"] == "y" * 500
            span_ids.add(span.payload["span_id"])

        expected_span_ids = {"a" * 16, "b" * 16, "c" * 16}
        assert span_ids == expected_span_ids

        buffer.done_flush_segments(segments)
        assert_clean(buffer.client)


@mock.patch("sentry.spans.buffer.Project")
def test_max_segment_bytes_detaches_over_limit(mock_project_model, buffer: SpansBuffer) -> None:
    """When a segment's cumulative ingested bytes exceed max-segment-bytes, subsequent
    subsegments are written to a detached (salted) key so that overflow spans are not lost."""
    mock_project = mock.Mock()
    mock_project.id = 1
    mock_project.organization_id = 100
    mock_project_model.objects.get_from_cache.return_value = mock_project

    # Each payload is ~30 bytes. With limit=40, the Lua script detaches on
    # the 3rd batch (cumulative 60 > 40). The flusher also enforces the limit,
    # so the normal segment (60 bytes) is dropped, but the detached segment
    # (30 bytes) is kept.
    batch1 = [
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
        ),
    ]
    batch2 = [
        Span(
            payload=_payload("c" * 16),
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
        ),
    ]
    batch3 = [
        Span(
            payload=_payload("d" * 16),
            trace_id="a" * 32,
            span_id="d" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
        ),
    ]

    with override_options({"spans.buffer.max-segment-bytes": 70}):
        buffer.process_spans(batch1, now=0)
        buffer.process_spans(batch2, now=0)
        buffer.process_spans(batch3, now=0)
        rv = buffer.flush_segments(now=61)

    assert len(rv) == 2

    normal_key = _segment_id(1, "a" * 32, "a" * 16)
    normal_segment = rv.get(normal_key)
    assert normal_segment is not None
    assert len(normal_segment.spans) == 2

    # The new segment (salt) contains the overflow span
    detached_keys = [k for k in rv if k != normal_key]
    assert len(detached_keys) == 1
    detached_segment = rv[detached_keys[0]]
    assert len(detached_segment.spans) == 1
    assert detached_segment.spans[0].payload["span_id"] == "d" * 16


@mock.patch("sentry.spans.buffer.Project")
def test_max_segment_bytes_under_limit_merges_normally(
    mock_project_model, buffer: SpansBuffer
) -> None:
    """When a segment is within max-segment-bytes, subsegments merge normally."""
    mock_project = mock.Mock()
    mock_project.id = 1
    mock_project.organization_id = 100
    mock_project_model.objects.get_from_cache.return_value = mock_project

    batch1 = [
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
        ),
    ]
    batch2 = [
        Span(
            payload=_payload("c" * 16),
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
        ),
    ]

    # Large limit so both batches fit
    with override_options(
        {
            "spans.buffer.max-segment-bytes": 10 * 1024 * 1024,
        }
    ):
        buffer.process_spans(batch1, now=0)
        buffer.process_spans(batch2, now=0)
        rv = buffer.flush_segments(now=61)

    # Both spans merged into a single segment
    assert len(rv) == 1
    segment = rv[_segment_id(1, "a" * 32, "a" * 16)]
    assert len(segment.spans) == 2
    span_ids = {s.payload["span_id"] for s in segment.spans}
    assert span_ids == {"b" * 16, "c" * 16}


@mock.patch("sentry.spans.buffer.Project")
def test_flush_oversized_segments(mock_project_model, buffer: SpansBuffer) -> None:
    """When cumulative bytes exceed max-segment-bytes, spans split across
    segments but none are dropped."""
    mock_project = mock.Mock()
    mock_project.id = 1
    mock_project.organization_id = 100
    mock_project_model.objects.get_from_cache.return_value = mock_project

    batch1 = [
        Span(
            payload=_payload("c" * 16),
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
        ),
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
        ),
    ]
    batch2 = [
        Span(
            payload=_payload("d" * 16),
            trace_id="a" * 32,
            span_id="d" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
        ),
        Span(
            payload=_payload("e" * 16),
            trace_id="a" * 32,
            span_id="e" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
        ),
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id=None,
            project_id=1,
            segment_id=None,
            is_segment_span=True,
        ),
    ]

    # `now=61` is past the non-root timeout (60) so the parent segment also flushes.
    with override_options({"spans.buffer.max-segment-bytes": 100}):
        buffer.process_spans(batch1, now=0)
        buffer.process_spans(batch2, now=0)
        rv = buffer.flush_segments(now=61)

    all_span_ids = {span.payload["span_id"] for seg in rv.values() for span in seg.spans}
    assert all_span_ids == {"a" * 16, "b" * 16, "c" * 16, "d" * 16, "e" * 16}
    assert sum(len(seg.spans) for seg in rv.values()) == 5
    # Confirms the byte-limit detach actually triggered. Exact count depends on
    # max-spans-per-evalsha chunking (2 segments for nochunk, 3 for chunk1).
    assert len(rv) >= 2


def test_to_messages_under_limit(buffer: SpansBuffer) -> None:
    spans = [{"span_id": "a"}, {"span_id": "b"}]
    segment = FlushedSegment(
        queue_key=b"test",
        spans=[OutputSpan(payload=s) for s in spans],
        project_id=1,
    )
    with override_options(
        {
            **DEFAULT_OPTIONS,
            "spans.buffer.max-segment-bytes": 10000,
        }
    ):
        messages = segment.to_messages()
    assert len(messages) == 1
    assert messages[0]["spans"] == spans
    assert "skip_enrichment" not in messages[0]
    assert "flush_id" in messages[0]
    assert len(messages[0]["flush_id"]) == 32  # UUID hex string


def test_to_messages_splits_oversized(buffer: SpansBuffer) -> None:
    spans = [
        {
            "span_id": "a" * 16,
            "is_segment": True,
            "attributes": {"sentry.segment.id": {"type": "string", "value": "a" * 16}},
        },
        {
            "span_id": "b" * 16,
            "is_segment": False,
            "attributes": {"sentry.segment.id": {"type": "string", "value": "a" * 16}},
        },
        {
            "span_id": "c" * 16,
            "is_segment": False,
            "attributes": {"sentry.segment.id": {"type": "string", "value": "a" * 16}},
        },
        {
            "span_id": "d" * 16,
            "is_segment": False,
            "attributes": {"sentry.segment.id": {"type": "string", "value": "a" * 16}},
        },
        {
            "span_id": "e" * 16,
            "is_segment": False,
            "attributes": {"sentry.segment.id": {"type": "string", "value": "a" * 16}},
        },
    ]
    segment = FlushedSegment(
        queue_key=b"test",
        spans=[OutputSpan(payload=s) for s in spans],
        project_id=1,
    )
    with override_options(
        {
            **DEFAULT_OPTIONS,
            "spans.buffer.max-segment-bytes": 500,
        }
    ):
        messages = segment.to_messages()

    assert len(messages) == 2
    assert [len(m["spans"]) for m in messages] == [3, 2]

    all_spans = [span for m in messages for span in m["spans"]]
    assert all_spans == spans

    for message in messages:
        assert message["skip_enrichment"] is True
        assert "flush_id" in message
        assert len(message["flush_id"]) == 32

    # Each chunk gets a unique flush_id
    flush_ids = [m["flush_id"] for m in messages]
    assert len(set(flush_ids)) == len(flush_ids)

    for message in messages[:-1]:
        chunk_size = sum(len(orjson.dumps(s)) for s in message["spans"])
        assert chunk_size <= 500


def test_to_messages_single_large_span(buffer: SpansBuffer) -> None:
    """A single span larger than max_bytes still gets its own message."""
    segment = FlushedSegment(
        queue_key=b"test",
        spans=[OutputSpan(payload={"span_id": "a" * 16})],
        project_id=1,
    )
    with override_options(
        {
            **DEFAULT_OPTIONS,
            "spans.buffer.max-segment-bytes": 10,
        }
    ):
        messages = segment.to_messages()
    assert len(messages) == 1
    assert messages[0]["skip_enrichment"] is True
    assert "flush_id" in messages[0]
    assert len(messages[0]["flush_id"]) == 32


def test_to_messages_unique_flush_ids_across_calls(buffer: SpansBuffer) -> None:
    """Calling to_messages() twice produces unique flush_ids (dedup detection)."""
    spans = [{"span_id": "a"}, {"span_id": "b"}]
    segment = FlushedSegment(
        queue_key=b"test",
        spans=[OutputSpan(payload=s) for s in spans],
        project_id=1,
    )
    with override_options(
        {
            **DEFAULT_OPTIONS,
            "spans.buffer.max-segment-bytes": 10000,
        }
    ):
        messages1 = segment.to_messages()
        messages2 = segment.to_messages()

    assert messages1[0]["flush_id"] != messages2[0]["flush_id"]


def test_kafka_slice_id(buffer: SpansBuffer) -> None:
    with override_options(DEFAULT_OPTIONS):
        buffer = SpansBuffer(assigned_shards=list(range(1)), slice_id=2)

        queue_key = buffer.store.get_queue_key(0)
        assert queue_key == b"span-buf:q:2-0"

        spans = [
            Span(
                payload=_payload("a" * 16),
                trace_id="a" * 32,
                span_id="a" * 16,
                parent_span_id=None,
                project_id=1,
                segment_id=None,
                is_segment_span=True,
            )
        ]

        process_spans(spans, buffer, now=0)

        assert buffer.client.keys("span-buf:q:*") == [queue_key]

        segments = buffer.flush_segments(now=11)
        buffer.done_flush_segments(segments)
        assert_clean(buffer.client)


def test_preassigned_disconnected_segment(buffer: SpansBuffer) -> None:
    # Test that a segment with two spans that are not directly connected, but
    # where the `segment_id` is available ahead of time, is correctly joined and
    # returned.

    spans = [
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id="c" * 16,  # does not exist in this segment
            project_id=1,
            segment_id="a" * 16,  # refers to the correct span below
        ),
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id=None,
            project_id=1,
            segment_id="a" * 16,
            is_segment_span=True,
        ),
    ]

    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): FlushedSegment(
            queue_key=mock.ANY,
            payload_keys=mock.ANY,
            project_id=1,
            spans=[
                _output_segment(b"a" * 16, b"a" * 16, True),
                _output_segment(b"b" * 16, b"a" * 16, False),
            ],
        )
    }
    buffer.done_flush_segments(rv)
    assert buffer.flush_segments(now=30) == {}

    assert list(buffer.get_memory_info())

    assert_clean(buffer.client)


def test_partition_routing_stable_across_rebalance() -> None:
    """
    Verify that spans are routed to the queue matching their source Kafka
    partition, so that rebalancing (changing assigned_shards) does not cause
    a segment to be split across queues.
    """
    with override_options(DEFAULT_OPTIONS):
        buf = SpansBuffer(assigned_shards=list(range(3)))
        buf.client.flushdb()

        partition = 1
        spans_before = [
            Span(
                payload=_payload("a" * 16),
                trace_id="a" * 32,
                span_id="a" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
                partition=partition,
            ),
        ]
        buf.process_spans(spans_before, now=0)

        # Simulate rebalance: consumer now owns partitions 1, 2, 3
        buf.assigned_shards = [1, 2, 3]

        spans_after = [
            Span(
                payload=_payload("b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                segment_id=None,
                project_id=1,
                is_segment_span=True,
                partition=partition,
            ),
        ]
        buf.process_spans(spans_after, now=1)

        # Both spans should be flushed together in a single segment from
        # the queue for partition 1, not split across different queues.
        rv = buf.flush_segments(now=12)
        _normalize_output(rv)

        seg_key = _segment_id(1, "a" * 32, "b" * 16)
        assert seg_key in rv
        assert len(rv) == 1
        assert len(rv[seg_key].spans) == 2
        assert rv[seg_key].queue_key == b"span-buf:q:1"

        buf.done_flush_segments(rv)
        assert_clean(buf.client)


@override_options(DEFAULT_OPTIONS)
def test_done_flush_cleans_up(buffer: SpansBuffer) -> None:
    """
    Test that done_flush_segments properly cleans up segment data
    (queue entry removed, set deleted, etc).
    """
    spans = [
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
        ),
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id=None,
            segment_id=None,
            is_segment_span=True,
            project_id=1,
        ),
    ]
    process_spans(spans, buffer, now=0)

    rv = buffer.flush_segments(now=11)
    assert len(rv) == 1

    # No new spans arrive — done_flush should clean up fully
    buffer.done_flush_segments(rv)

    # Nothing left to flush
    assert buffer.flush_segments(now=30) == {}
    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "flush_lock_ttl, expected_flushed_segments",
    [
        pytest.param(0, 2, id="lock-disabled-duplicate-flushes"),
        pytest.param(10, 1, id="lock-enabled-flush-once"),
    ],
)
def test_flush_lock(
    buffer: SpansBuffer, flush_lock_ttl: int, expected_flushed_segments: int
) -> None:
    """
    Tests the segment flush lock that prevents two buffers from flushing the same
    segment concurrently and producing duplicated spans.
    """
    # First span comes in from partition 0, goes into shard 0's queue.
    process_spans(
        [
            Span(
                payload=_payload("b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                segment_id=None,
                is_segment_span=True,
                project_id=1,
                partition=0,
            ),
        ],
        buffer,
        now=0,
    )
    # Second span comes in from partition 1, goes into shard 1's queue.
    process_spans(
        [
            Span(
                payload=_payload("a" * 16),
                trace_id="a" * 32,
                span_id="a" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
                partition=1,
            ),
        ],
        buffer,
        now=0,
    )

    buffer_a = SpansBuffer(assigned_shards=[0], slice_id=buffer.slice_id)
    buffer_b = SpansBuffer(assigned_shards=[1], slice_id=buffer.slice_id)

    with override_options({"spans.buffer.flusher.flush-lock-ttl": flush_lock_ttl}):
        rv_a = buffer_a.flush_segments(now=11)
        rv_b = buffer_b.flush_segments(now=11)
        buffer_a.done_flush_segments(rv_a)
        buffer_b.done_flush_segments(rv_b)
        assert len(rv_a) + len(rv_b) == expected_flushed_segments


def test_flush_lock_released_after_done_flush(buffer: SpansBuffer) -> None:
    """
    A single flusher releases the segment flush lock during cleanup.
    """
    process_spans(
        [
            Span(
                payload=_payload("b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                segment_id=None,
                is_segment_span=True,
                project_id=1,
            ),
        ],
        buffer,
        now=0,
    )

    with override_options({"spans.buffer.flusher.flush-lock-ttl": 60}):
        rv = buffer.flush_segments(now=11)
        segment_key = next(iter(rv))
        lock_key = buffer.store.get_flush_lock_key(segment_key)
        assert buffer.client.exists(lock_key) == 1

        buffer.done_flush_segments(rv)
        assert buffer.client.exists(lock_key) == 0

    assert_clean(buffer.client)


def test_flush_lock_cleanup_releases_stale_queue_entry(buffer: SpansBuffer) -> None:
    """
    Two shard queues can contain the same segment.

    The first flusher produces the segment and releases the lock during cleanup.
    The second flusher then acquires the lock and removes its stale queue entry
    without producing spans again.
    """
    process_spans(
        [
            Span(
                payload=_payload("b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                segment_id=None,
                is_segment_span=True,
                project_id=1,
                partition=0,
            ),
        ],
        buffer,
        now=0,
    )

    process_spans(
        [
            Span(
                payload=_payload("a" * 16),
                trace_id="a" * 32,
                span_id="a" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
                partition=1,
            ),
        ],
        buffer,
        now=0,
    )

    buffer_a = SpansBuffer(assigned_shards=[0], slice_id=buffer.slice_id)
    buffer_b = SpansBuffer(assigned_shards=[1], slice_id=buffer.slice_id)

    with override_options({"spans.buffer.flusher.flush-lock-ttl": 10}):
        rv_a = buffer_a.flush_segments(now=11)
        rv_b = buffer_b.flush_segments(now=11)

        segment_key = next(iter(rv_a))
        queue_key_a = buffer_a.store.get_queue_key(0)
        queue_key_b = buffer_b.store.get_queue_key(1)
        lock_key = buffer_a.store.get_flush_lock_key(segment_key)

        assert len(rv_a) == 1
        assert rv_b == {}
        assert buffer.client.zscore(queue_key_a, segment_key) is not None
        assert buffer.client.zscore(queue_key_b, segment_key) is not None

        buffer_a.done_flush_segments(rv_a)

        assert buffer.client.zscore(queue_key_a, segment_key) is None
        assert buffer.client.zscore(queue_key_b, segment_key) is not None
        assert buffer.client.exists(lock_key) == 0

        stale_rv = buffer_b.flush_segments(now=12)
        assert stale_rv[segment_key].spans == []
        buffer_b.done_flush_segments(stale_rv)

    assert buffer.client.zscore(queue_key_b, segment_key) is None
    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "flush_lock_ttl, expected_flushed_segments",
    [
        pytest.param(0, 8, id="lock-disabled-segments-double-flushed"),
        pytest.param(10, 6, id="lock-enabled-contended-segments-flushed-once"),
    ],
)
def test_flush_lock_mixed_contention(
    buffer: SpansBuffer, flush_lock_ttl: int, expected_flushed_segments: int
) -> None:
    """
    Two buffers with some segments of their own plus two segments that sit in both
    queues. The lock should only prevent the contended segments from being flushed
    twice, other segments must still be flushed normally.
    """
    contended_traces = ["a" * 32, "b" * 32]
    shard_0_only_traces = ["c" * 32]
    shard_1_only_traces = ["d" * 32, "e" * 32, "f" * 32]
    root_span_id = "1" * 16
    child_span_id = "2" * 16

    for trace_id in shard_0_only_traces + shard_1_only_traces:
        partition = 0 if trace_id in shard_0_only_traces else 1
        process_spans(
            [
                Span(
                    payload=_payload(root_span_id),
                    trace_id=trace_id,
                    span_id=root_span_id,
                    parent_span_id=None,
                    segment_id=None,
                    is_segment_span=True,
                    project_id=1,
                    partition=partition,
                ),
            ],
            buffer,
            now=0,
        )

    for trace_id in contended_traces:
        process_spans(
            [
                Span(
                    payload=_payload(root_span_id),
                    trace_id=trace_id,
                    span_id=root_span_id,
                    parent_span_id=None,
                    segment_id=None,
                    is_segment_span=True,
                    project_id=1,
                    partition=0,
                ),
            ],
            buffer,
            now=0,
        )
        process_spans(
            [
                Span(
                    payload=_payload(child_span_id),
                    trace_id=trace_id,
                    span_id=child_span_id,
                    parent_span_id=root_span_id,
                    segment_id=None,
                    project_id=1,
                    partition=1,
                ),
            ],
            buffer,
            now=0,
        )

    buffer_a = SpansBuffer(assigned_shards=[0], slice_id=buffer.slice_id)
    buffer_b = SpansBuffer(assigned_shards=[1], slice_id=buffer.slice_id)

    with override_options({"spans.buffer.flusher.flush-lock-ttl": flush_lock_ttl}):
        rv_a = buffer_a.flush_segments(now=11)
        rv_b = buffer_b.flush_segments(now=11)
        buffer_a.done_flush_segments(rv_a)
        buffer_b.done_flush_segments(rv_b)
        assert len(rv_a) + len(rv_b) == expected_flushed_segments


@mock.patch("sentry.spans.buffer.Project")
def test_flush_lock_detaches_subsegment(mock_project_model, buffer: SpansBuffer) -> None:
    """
    Tests that a span that arrives while a segment is being flushed detaches
    to a new segment rather than merge into the locked segment.
    """
    mock_project = mock.Mock()
    mock_project.id = 1
    mock_project.organization_id = 100
    mock_project_model.objects.get_from_cache.return_value = mock_project

    root_span = Span(
        payload=_payload("b" * 16),
        trace_id="a" * 32,
        span_id="b" * 16,
        parent_span_id=None,
        segment_id=None,
        is_segment_span=True,
        project_id=1,
    )
    concurrent_span = Span(
        payload=_payload("c" * 16),
        trace_id="a" * 32,
        span_id="c" * 16,
        parent_span_id="b" * 16,
        segment_id=None,
        project_id=1,
    )

    normal_key = _segment_id(1, "a" * 32, "b" * 16)

    with override_options(
        {
            "spans.buffer.flusher.flush-lock-ttl": 20,
        }
    ):
        buffer.process_spans([root_span], now=0)
        rv = buffer.flush_segments(now=11)
        buffer.process_spans([concurrent_span], now=12)
        buffer.done_flush_segments(rv)
        rv2 = buffer.flush_segments(now=120)

    detached_keys = [k for k in rv2 if k != normal_key]
    assert len(detached_keys) == 1
    detached_segment = rv2[detached_keys[0]]
    assert len(detached_segment.spans) == 1
    assert detached_segment.spans[0].payload["span_id"] == "c" * 16

    buffer.done_flush_segments(rv2)


@mock.patch("sentry.spans.buffer.Project")
def test_no_duplicate_flush_after_lock_expiry_and_new_spans(
    mock_project_model, buffer: SpansBuffer
) -> None:
    """
    Regression test for the double-flush bug caused by interaction between
    flush locks (https://github.com/getsentry/sentry/pull/113850) and
    conditional cleanup (https://github.com/getsentry/sentry/pull/110462)

    Scenario:
    1. Buffer flushes segment, captures queue score $OLD, acquires lock
    2. Lock expires (simulated by deleting the key)
    3. New spans arrive, there is no lock, so they MERGE (not detach), updating queue score
    4. Buffer calls done_flush_segments with the $OLD captured score, so in the end nothing is deleted.
    5. Flusher iterates again, and flushes the same segment again.

    The fix is to remove conditional cleanup from https://github.com/getsentry/sentry/pull/110462 entirely.
    """
    mock_project = mock.Mock()
    mock_project.id = 1
    mock_project.organization_id = 100
    mock_project_model.objects.get_from_cache.return_value = mock_project

    segment_key = _segment_id(1, "a" * 32, "b" * 16)

    # Step 1: Create initial segment
    process_spans(
        [
            Span(
                payload=_payload("b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                segment_id=None,
                is_segment_span=True,
                project_id=1,
                partition=0,
            ),
            Span(
                payload=_payload("a" * 16),
                trace_id="a" * 32,
                span_id="a" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
                partition=0,
            ),
        ],
        buffer,
        now=0,
    )

    with override_options({"spans.buffer.flusher.flush-lock-ttl": 60}):
        # Step 2: Buffer flushes segment, captures score, acquires lock
        rv = buffer.flush_segments(now=11)
        assert len(rv) == 1
        assert segment_key in rv
        assert len(rv[segment_key].spans) == 2

        # Step 3: Simulate lock expiration by deleting it
        buffer.client.delete(buffer.store.get_flush_lock_key(segment_key))

        # Step 4: New spans arrive while "producing to Kafka"
        # Lock is gone, so they MERGE into segment (not detach)
        # This updates the queue score via ZADD (new deadline based on now=50)
        process_spans(
            [
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                    partition=0,
                ),
            ],
            buffer,
            now=50,
        )

        # Step 5: Buffer calls done_flush_segments with OLD captured score
        # score mismatch (11 vs 60) -> cleanup skipped (iff
        # https://github.com/getsentry/sentry/pull/110462 is still applied)
        buffer.done_flush_segments(rv)

        rv2 = buffer.flush_segments(now=120)

        # Assert that the lock actually prevents double-flushing.
        assert not rv2


_LOAD_SEGMENT_REDIS_TTL = cast(int, DEFAULT_OPTIONS["spans.buffer.redis-ttl"])
_LOAD_SEGMENT_ROOT_TIMEOUT = cast(int, DEFAULT_OPTIONS["spans.buffer.root-timeout"])


def test_build_flushed_segments_adds_segment_metadata() -> None:
    buffer = SpansBuffer(assigned_shards=[0])
    trace_id = "a" * 32
    segment_span_id = "b" * 16
    child_span_id = "c" * 16
    segment_key = _segment_id(1, trace_id, segment_span_id)
    queue_key = buffer.store.get_queue_key(0)
    payload_key = _payload_key(1, trace_id, "1" * 32)
    flush_candidate = FlushCandidate(0, queue_key, segment_key, 5)

    flushed_segments, num_has_root_spans, _ = buffer._build_flushed_segments(
        [
            LoadedSegment(
                flush_candidate,
                [_payload(segment_span_id), _payload(child_span_id)],
                [payload_key],
            )
        ],
        max_segments_per_shard=2,
        now=10,
    )

    flushed_segment = flushed_segments[segment_key]
    output_payloads = {span.payload["span_id"]: span.payload for span in flushed_segment.spans}
    assert flushed_segment.queue_key == queue_key
    assert flushed_segment.project_id == 1
    assert flushed_segment.payload_keys == [payload_key]
    assert output_payloads[segment_span_id]["is_segment"] is True
    assert output_payloads[child_span_id]["is_segment"] is False
    assert (
        output_payloads[child_span_id]["attributes"]["sentry.segment.id"]["value"]
        == segment_span_id
    )
    assert num_has_root_spans == 1


def test_record_segment_loss_metrics_records_dropped_spans() -> None:
    buffer = SpansBuffer(assigned_shards=[0])
    trace_id = "a" * 32
    segment_key = _segment_id(1, trace_id, "b" * 16)
    payload_key = _payload_key(1, trace_id, "1" * 32)
    span_a = _payload("a" * 16)
    loaded_segment = LoadedSegment(
        FlushCandidate(0, buffer.store.get_queue_key(0), segment_key, 5),
        payloads=[span_a],
        payload_keys=[payload_key],
        ingest_metadata=SegmentIngestMetadata(
            ingested_count=3,
            ingested_byte_count=len(span_a),
        ),
    )

    mock_project = mock.Mock(id=1, organization_id=100)
    with (
        mock.patch("sentry.spans.buffer.Project") as project_model,
        mock.patch("sentry.spans.buffer.track_outcome") as track_outcome,
    ):
        project_model.objects.get_many_from_cache.return_value = [mock_project]
        buffer._record_segment_loss_metrics(
            [loaded_segment],
            now=0,
        )

    assert loaded_segment.payloads == [span_a]
    assert loaded_segment.payload_keys == [payload_key]
    assert loaded_segment.ingest_metadata == SegmentIngestMetadata(
        ingested_count=3,
        ingested_byte_count=len(span_a),
    )
    track_outcome.assert_called_once()
    outcome_kwargs = track_outcome.call_args.kwargs
    assert outcome_kwargs["org_id"] == 100
    assert outcome_kwargs["project_id"] == 1
    assert outcome_kwargs["key_id"] is None
    assert outcome_kwargs["outcome"] == Outcome.INVALID
    assert outcome_kwargs["reason"] == "segment_too_large"
    assert outcome_kwargs["category"] == DataCategory.SPAN_INDEXED
    assert outcome_kwargs["quantity"] == 2


@pytest.mark.parametrize(
    ("deadline", "now", "expected_expired"),
    [
        pytest.param(
            0,
            _LOAD_SEGMENT_REDIS_TTL - _LOAD_SEGMENT_ROOT_TIMEOUT + 1,
            True,
            id="expired",
        ),
        pytest.param(
            0,
            _LOAD_SEGMENT_REDIS_TTL - _LOAD_SEGMENT_ROOT_TIMEOUT,
            False,
            id="not-expired",
        ),
    ],
)
def test_record_segment_loss_metrics_records_empty_expired_segments(
    deadline: int, now: int, expected_expired: bool
) -> None:
    buffer = SpansBuffer(assigned_shards=[0])
    trace_id = "a" * 32
    segment_key = _segment_id(1, trace_id, "b" * 16)
    loaded_segment = LoadedSegment(
        FlushCandidate(0, buffer.store.get_queue_key(0), segment_key, deadline),
        payloads=[],
        payload_keys=[],
    )

    with (
        mock.patch.object(buffer.store, "get_current_queue_deadline", return_value=deadline),
        mock.patch("sentry.spans.buffer.metrics.incr") as metrics_incr,
    ):
        buffer._record_segment_loss_metrics(
            [loaded_segment],
            now=now,
        )

    assert loaded_segment.payloads == []
    assert loaded_segment.payload_keys == []
    incr_names = [call.args[0] for call in metrics_incr.call_args_list]
    assert ("spans.buffer.segment_expired_before_flush" in incr_names) is expected_expired
    assert "spans.buffer.empty_segments" in incr_names


# --- Distributed payload keys tests ---


def _dspan(
    span_id: str,
    parent_span_id: str | None = None,
    is_root: bool = False,
) -> Span:
    return Span(
        payload=_payload(span_id),
        trace_id="a" * 32,
        span_id=span_id,
        parent_span_id=parent_span_id,
        segment_id=None,
        is_segment_span=is_root,
        project_id=1,
    )


@pytest.fixture(
    params=[
        pytest.param("cluster", id="cluster"),
        pytest.param("single", id="single"),
    ]
)
def distributed_buffer(request):
    redis_type = request.param
    with override_options(DEFAULT_OPTIONS):
        if redis_type == "cluster":
            from sentry.testutils.helpers.redis import use_redis_cluster
            from sentry.utils import redis as redis_utils

            with use_redis_cluster(
                "span-buffer",
                with_settings={"SENTRY_SPAN_BUFFER_CLUSTER": "span-buffer"},
            ):
                buf = SpansBuffer(assigned_shards=list(range(32)))
                buf.client.flushall()
                yield buf
                redis_utils.redis_clusters._clusters_bytes.pop("span-buffer", None)
        else:
            buf = SpansBuffer(assigned_shards=list(range(32)))
            buf.client.flushdb()
            yield buf


def test_distributed_basic(distributed_buffer: SpansBuffer) -> None:
    """Single segment with root span works across all option combos."""
    buf = distributed_buffer
    process_spans([_dspan("a" * 16, "b" * 16), _dspan("b" * 16, is_root=True)], buf, now=0)
    assert_ttls(buf.client)

    rv = buf.flush_segments(now=11)
    _normalize_output(rv)
    seg_key = _segment_id(1, "a" * 32, "b" * 16)
    assert len(rv[seg_key].spans) == 2
    buf.done_flush_segments(rv)
    assert_clean(buf.client)


def test_distributed_multi_batch_merge(distributed_buffer: SpansBuffer) -> None:
    """Spans arrive in multiple batches, later batch discovers the root."""
    buf = distributed_buffer
    buf.process_spans([_dspan("a" * 16, "b" * 16)], now=0)
    buf.process_spans([_dspan("b" * 16, is_root=True)], now=1)
    assert_ttls(buf.client)

    rv = buf.flush_segments(now=12)
    seg_key = _segment_id(1, "a" * 32, "b" * 16)
    assert len(rv[seg_key].spans) == 2
    buf.done_flush_segments(rv)
    assert_clean(buf.client)


def test_distributed_deep_tree(distributed_buffer: SpansBuffer) -> None:
    """Chain d->c->b->a (root), each in a separate batch."""
    buf = distributed_buffer
    buf.process_spans([_dspan("d" * 16, "c" * 16)], now=0)
    buf.process_spans([_dspan("c" * 16, "b" * 16)], now=1)
    buf.process_spans([_dspan("b" * 16, "a" * 16)], now=2)
    buf.process_spans([_dspan("a" * 16, is_root=True)], now=3)

    rv = buf.flush_segments(now=14)
    _normalize_output(rv)
    seg_key = _segment_id(1, "a" * 32, "a" * 16)
    assert len(rv[seg_key].spans) == 4
    assert {s.payload["span_id"] for s in rv[seg_key].spans} == {
        "a" * 16,
        "b" * 16,
        "c" * 16,
        "d" * 16,
    }
    buf.done_flush_segments(rv)
    assert_clean(buf.client)


def test_distributed_multiple_segments(distributed_buffer: SpansBuffer) -> None:
    """Two independent segments in the same trace."""
    buf = distributed_buffer
    process_spans([_dspan("a" * 16, is_root=True), _dspan("b" * 16, is_root=True)], buf, now=0)
    rv = buf.flush_segments(now=11)
    assert len(rv) == 2
    buf.done_flush_segments(rv)
    assert_clean(buf.client)


def test_distributed_payload_keys_populated(distributed_buffer: SpansBuffer) -> None:
    """Distributed payload keys and member-keys index are populated."""
    buf = distributed_buffer
    process_spans([_dspan("a" * 16, "b" * 16), _dspan("b" * 16, is_root=True)], buf, now=0)

    mk_key = b"span-buf:mk:{1:" + b"a" * 32 + b"}:" + b"b" * 16
    assert buf.client.scard(mk_key) > 0

    # Payload keys are salt-keyed (one per subsegment), tracked via mk.
    salts = buf.client.smembers(mk_key)
    assert salts
    for salt in salts:
        dist_key = b"span-buf:s:{1:" + b"a" * 32 + b":" + salt + b"}:" + salt
        assert buf.client.scard(dist_key) > 0

    rv = buf.flush_segments(now=11)
    set_key = _segment_id(1, "a" * 32, "b" * 16)
    assert len(rv[set_key].spans) == 2
    buf.done_flush_segments(rv)
    assert_clean(buf.client)


def _get_schema_examples():
    """Load all ingest-spans schema examples for parametrization."""
    examples = []
    for ex in sentry_kafka_schemas.iter_examples("ingest-spans"):
        examples.append(pytest.param(ex.load(), id=ex.path.stem))
    return examples


@pytest.mark.parametrize("example", _get_schema_examples())
def test_schema_examples(buffer: SpansBuffer, example: dict) -> None:
    """
    Feed official ingest-spans schema examples through the buffer pipeline
    to verify they are handled without errors.
    """
    # Replicate the parsing logic from process_batch() in factory.py
    segment_id = cast(str | None, attribute_value(example, "sentry.segment.id"))
    validate_span_event(cast(SpanEvent, example), segment_id)

    payload = orjson.dumps(example)

    span = Span(
        trace_id=example["trace_id"],
        span_id=example["span_id"],
        parent_span_id=example.get("parent_span_id"),
        segment_id=segment_id,
        project_id=example["project_id"],
        payload=payload,
        is_segment_span=bool(example.get("parent_span_id") is None or example.get("is_segment")),
    )

    process_spans([span], buffer, now=0)
    assert_ttls(buffer.client)

    # Flush past both root-timeout (10s) and timeout (60s)
    rv = buffer.flush_segments(now=61)

    assert len(rv) == 1
    segment = list(rv.values())[0]
    assert len(segment.spans) == 1

    output_span = segment.spans[0]
    assert output_span.payload["span_id"] == example["span_id"]
    assert output_span.payload["trace_id"] == example["trace_id"]

    # Verify top-level keys are preserved (except is_segment and attributes
    # which the buffer modifies)
    for key in example:
        if key in ("is_segment", "attributes"):
            continue
        assert key in output_span.payload, f"Key {key!r} missing from output payload"

    # Validate that the output span still conforms to the ingest-spans schema.
    # It's not explicitly written anywhere that the spans schema in
    # buffered-segments is the same one as the input schema, but right now
    # that's what it is.
    SPANS_CODEC.validate(cast(SpanEvent, output_span.payload))

    # Validate that the assembled segment conforms to the buffered-segments schema
    buffered_segments_codec = get_topic_codec(Topic.BUFFERED_SEGMENTS)
    buffered_segments_codec.validate({"spans": [span.payload for span in segment.spans]})

    buffer.done_flush_segments(rv)
    assert_clean(buffer.client)
