from __future__ import annotations

import itertools
from collections.abc import Sequence
from unittest import mock

import orjson
import pytest
from sentry_redis_tools.clients import StrictRedis

from sentry.spans.buffer import FlushedSegment, OutputSpan, Span, SpansBuffer
from sentry.spans.segment_key import SegmentKey
from sentry.testutils.helpers.options import override_options

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
    "spans.buffer.flusher-cumulative-logger-enabled": False,
    "spans.buffer.compression.level": 0,
    "spans.buffer.pipeline-batch-size": 0,
    "spans.buffer.max-spans-per-evalsha": 0,
    "spans.buffer.evalsha-latency-threshold": 100,
    "spans.buffer.debug-traces": [],
    "spans.buffer.evalsha-cumulative-logger-enabled": True,
    "spans.buffer.done-flush-conditional-zrem": False,
    "spans.buffer.write-distributed-payloads": False,
    "spans.buffer.read-distributed-payloads": False,
    "spans.buffer.write-merged-payloads": True,
}


def shallow_permutations(spans: list[Span]) -> list[list[Span]]:
    return [
        spans,
        list(reversed(spans)),
        [span_or_split for span in spans for span_or_split in [span, _SplitBatch()]],  # type: ignore[misc]
    ]


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


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


def assert_ttls(client: StrictRedis[bytes]):
    """
    Check that all keys have a TTL, because if the consumer dies before
    flushing, we should not leak memory.
    """

    for k in client.keys("*"):
        assert client.ttl(k) > -1, k


def assert_clean(client: StrictRedis[bytes]):
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
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id=None,
                    segment_id=None,
                    is_segment_span=True,
                    project_id=1,
                    end_timestamp=1700000000.0,
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
            score=mock.ANY,
            ingested_count=mock.ANY,
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


@mock.patch("sentry.spans.buffer.emit_observability_metrics")
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
            end_timestamp=1700000000.0,
        ),
        Span(
            payload=_payload("d" * 16),
            trace_id="a" * 32,
            span_id="d" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
        Span(
            payload=_payload("c" * 16),
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id=None,
            segment_id=None,
            is_segment_span=True,
            project_id=1,
            end_timestamp=1700000000.0,
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
            score=mock.ANY,
            ingested_count=mock.ANY,
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


@mock.patch("sentry.spans.buffer.emit_observability_metrics")
def test_observability_metrics_parent_span_already_oversized(
    emit_observability_metrics: mock.MagicMock,
    buffer: SpansBuffer,
) -> None:
    # Disable compression so payload size in Redis is predictable, then force a
    # low max-segment-bytes threshold so the destination set is already too
    # large before merge.
    #
    # Batch 1: Span A (large payload, child of B) and Span B (root) build an
    # oversized segment keyed on B.
    # Batch 2: Span C (child of A) arrives in a separate batch. Its redirect
    # resolves to B's set, triggering a merge where dest_bytes > threshold.
    oversized_payload = orjson.dumps({"span_id": "a" * 16, "blob": "x" * 2048})
    spans: list[Span | _SplitBatch] = [
        Span(
            payload=oversized_payload,
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id=None,
            segment_id=None,
            is_segment_span=True,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
        _SplitBatch(),
        Span(
            payload=_payload("c" * 16),
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
    ]

    with override_options({"spans.buffer.max-segment-bytes": 200}):
        process_spans(spans, buffer, now=0)

    assert emit_observability_metrics.call_count == 2

    oversized_metric_values = [
        value
        for call in emit_observability_metrics.call_args_list
        for evalsha_metrics in call[0][1]
        for metric_name, value in evalsha_metrics
        if metric_name == b"parent_span_set_already_oversized"
    ]
    assert oversized_metric_values, (
        "Expected parent_span_set_already_oversized metric to be emitted"
    )
    assert 1 in oversized_metric_values, (
        "Expected at least one evalsha call with an already oversized parent set"
    )


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
            end_timestamp=1700000000.0,
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
                    end_timestamp=1700000000.0,
                ),
                _SplitBatch(),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id="a" * 16,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="a" * 16,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
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
            score=mock.ANY,
            ingested_count=mock.ANY,
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
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id="c" * 16,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="a" * 16,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
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
            score=mock.ANY,
            ingested_count=mock.ANY,
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
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("e" * 16),
                    trace_id="a" * 32,
                    span_id="e" * 16,
                    parent_span_id="b" * 16,
                    segment_id=None,
                    project_id=1,
                    end_timestamp=1700000000.0,
                ),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    segment_id=None,
                    project_id=2,
                    end_timestamp=1700000000.0,
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
            score=mock.ANY,
            ingested_count=mock.ANY,
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
            score=mock.ANY,
            ingested_count=mock.ANY,
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
                end_timestamp=1700000000.0,
            ),
            Span(
                payload=_payload("d" * 16),
                trace_id="a" * 32,
                span_id="d" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
                end_timestamp=1700000000.0,
            ),
            Span(
                payload=_payload("e" * 16),
                trace_id="a" * 32,
                span_id="e" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
                end_timestamp=1700000000.0,
            ),
            Span(
                payload=_payload("b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                is_segment_span=True,
                segment_id=None,
                project_id=2,
                end_timestamp=1700000000.0,
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
            score=mock.ANY,
            ingested_count=mock.ANY,
            project_id=2,
            spans=[_output_segment(b"b" * 16, b"b" * 16, True)],
        ),
        _segment_id(1, "a" * 32, "c" * 16): FlushedSegment(
            queue_key=mock.ANY,
            score=mock.ANY,
            ingested_count=mock.ANY,
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
            score=mock.ANY,
            ingested_count=mock.ANY,
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
            end_timestamp=1700000000.0,
        )
    ]

    process_spans(spans, buffer, now=0)
    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): FlushedSegment(
            queue_key=mock.ANY,
            score=mock.ANY,
            ingested_count=mock.ANY,
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
                end_timestamp=1700000000.0,
            ),
            Span(
                payload=make_payload("a" * 16),
                trace_id="a" * 32,
                span_id="a" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
                end_timestamp=1700000000.0,
            ),
            Span(
                payload=make_payload("c" * 16),
                trace_id="a" * 32,
                span_id="c" * 16,
                parent_span_id="b" * 16,
                segment_id=None,
                project_id=1,
                end_timestamp=1700000000.0,
            ),
        ]

        buffer.process_spans(spans, now=0)

        segment_key = _segment_id(1, "a" * 32, "b" * 16)
        stored_data = buffer.client.smembers(segment_key)
        assert len(stored_data) > 0

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
def test_max_segment_spans_limit(mock_project_model, buffer: SpansBuffer) -> None:
    # Mock the project lookup to avoid database access
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
            end_timestamp=1700000001.0,
        ),
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000002.0,
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
            end_timestamp=1700000003.0,
        ),
        Span(
            payload=_payload("e" * 16),
            trace_id="a" * 32,
            span_id="e" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000004.0,
        ),
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id=None,
            project_id=1,
            segment_id=None,
            is_segment_span=True,
            end_timestamp=1700000005.0,
        ),
    ]

    with override_options({"spans.buffer.max-segment-bytes": 100}):
        buffer.process_spans(batch1, now=0)
        buffer.process_spans(batch2, now=0)
        rv = buffer.flush_segments(now=11)

    # The entire segment should be dropped because it exceeds max_segment_bytes.
    segment = rv[_segment_id(1, "a" * 32, "a" * 16)]
    assert segment.spans == []


@mock.patch("sentry.spans.buffer.Project")
@mock.patch("sentry.spans.buffer.track_outcome")
@mock.patch("sentry.spans.buffer.metrics.timing")
def test_dropped_spans_emit_outcomes(
    mock_metrics, mock_track_outcome, mock_project_model, buffer: SpansBuffer
) -> None:
    """Test that outcomes are emitted when Redis drops spans due to size limit."""
    from sentry.constants import DataCategory
    from sentry.utils.outcomes import Outcome

    # Mock the project lookup
    mock_project = mock.Mock()
    mock_project.id = 1
    mock_project.organization_id = 100
    mock_project_model.objects.get_from_cache.return_value = mock_project

    payload_a = _payload("a" * 16)
    payload_b = _payload("b" * 16)
    payload_c = _payload("c" * 16)
    payload_d = _payload("d" * 16)
    payload_e = _payload("e" * 16)
    payload_f = _payload("f" * 16)

    # Create a segment with many spans that will exceed the Redis memory limit
    batch1 = [
        Span(
            payload=payload_b,
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
        Span(
            payload=payload_c,
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000001.0,
        ),
        Span(
            payload=payload_d,
            trace_id="a" * 32,
            span_id="d" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000002.0,
        ),
    ]
    batch2 = [
        Span(
            payload=payload_e,
            trace_id="a" * 32,
            span_id="e" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000003.0,
        ),
        Span(
            payload=payload_f,
            trace_id="a" * 32,
            span_id="f" * 16,
            parent_span_id="a" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000004.0,
        ),
        Span(
            payload=payload_a,
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id=None,
            project_id=1,
            segment_id=None,
            is_segment_span=True,
            end_timestamp=1700000005.0,
        ),
    ]

    expected_bytes = sum(
        len(p) for p in [payload_a, payload_b, payload_c, payload_d, payload_e, payload_f]
    )

    # Set a very small max-segment-bytes to force Redis to drop spans
    with override_options({"spans.buffer.max-segment-bytes": 100}):
        buffer.process_spans(batch1, now=0)
        buffer.process_spans(batch2, now=0)
        buffer.flush_segments(now=11)

    # Verify that track_outcome was called
    assert mock_track_outcome.called, "track_outcome should be called when spans are dropped"

    # Find the call with INVALID outcome
    outcome_calls = [
        call
        for call in mock_track_outcome.call_args_list
        if call.kwargs.get("outcome") == Outcome.INVALID
    ]
    assert len(outcome_calls) > 0, "Should have at least one INVALID outcome"

    # Verify the outcome details
    outcome_call = outcome_calls[0]
    assert outcome_call.kwargs["org_id"] == 100
    assert outcome_call.kwargs["project_id"] == 1
    assert outcome_call.kwargs["outcome"] == Outcome.INVALID
    assert outcome_call.kwargs["reason"] == "segment_too_large"
    assert outcome_call.kwargs["category"] == DataCategory.SPAN_INDEXED
    assert outcome_call.kwargs["quantity"] > 0, "Should have dropped at least some spans"

    # Verify ingested span count and byte count metrics were emitted
    ingested_spans_timing_calls = [
        call
        for call in mock_metrics.call_args_list
        if call.args and call.args[0] == "spans.buffer.flush_segments.ingested_spans_per_segment"
    ]
    assert len(ingested_spans_timing_calls) == 1, "Should emit ingested_spans_per_segment metric"
    assert ingested_spans_timing_calls[0].args[1] == 6, "Should have ingested 6 spans"

    ingested_bytes_timing_calls = [
        call
        for call in mock_metrics.call_args_list
        if call.args and call.args[0] == "spans.buffer.flush_segments.ingested_bytes_per_segment"
    ]
    assert len(ingested_bytes_timing_calls) == 1, "Should emit ingested_bytes_per_segment metric"
    assert ingested_bytes_timing_calls[0].args[1] == expected_bytes


def test_kafka_slice_id(buffer: SpansBuffer) -> None:
    with override_options(DEFAULT_OPTIONS):
        buffer = SpansBuffer(assigned_shards=list(range(1)), slice_id=2)

        queue_key = buffer._get_queue_key(0)
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
                end_timestamp=1700000000.0,
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
            end_timestamp=1700000000.0,
        ),
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id=None,
            project_id=1,
            segment_id="a" * 16,
            is_segment_span=True,
            end_timestamp=1700000001.0,
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
            score=mock.ANY,
            ingested_count=mock.ANY,
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
                end_timestamp=1700000000.0,
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
                end_timestamp=1700000000.0,
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


@override_options({**DEFAULT_OPTIONS, "spans.buffer.done-flush-conditional-zrem": True})
def test_done_flush_skips_cleanup_when_new_spans_arrive(buffer: SpansBuffer) -> None:
    """
    Regression test: new spans arriving between flush_segments and
    done_flush_segments must not be silently lost. done_flush_segments should
    detect that the queue score changed (due to process_spans zadd) and skip
    cleanup, preserving the new spans for the next flush cycle.
    """
    # Step 1: ingest initial spans
    initial_spans = [
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id=None,
            segment_id=None,
            is_segment_span=True,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
    ]
    process_spans(initial_spans, buffer, now=0)

    # Step 2: flush_segments reads the data and captures the queue score
    rv = buffer.flush_segments(now=11)
    assert len(rv) == 1
    segment_key = next(iter(rv))

    # Step 3: simulate new spans arriving for the same segment (race window)
    # This updates the queue score via zadd with a new deadline
    new_spans = [
        Span(
            payload=_payload("c" * 16),
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
    ]
    process_spans(new_spans, buffer, now=20)

    # Step 4: done_flush_segments should detect score change and skip cleanup
    buffer.done_flush_segments(rv)

    # Step 5: the segment data should still be in Redis (not destroyed)
    # A subsequent flush should pick up the spans (old + new)
    rv2 = buffer.flush_segments(now=81)
    assert len(rv2) == 1
    _normalize_output(rv2)
    flushed = rv2[segment_key]
    span_ids = sorted(span.payload["span_id"] for span in flushed.spans)
    # All three spans should be present (at-least-once: old spans re-flushed + new span)
    assert "a" * 16 in span_ids
    assert "b" * 16 in span_ids
    assert "c" * 16 in span_ids

    # Clean up
    buffer.done_flush_segments(rv2)
    assert_clean(buffer.client)


@override_options({**DEFAULT_OPTIONS, "spans.buffer.done-flush-conditional-zrem": True})
def test_done_flush_cleans_up_when_no_new_spans(buffer: SpansBuffer) -> None:
    """
    When no new spans arrive between flush_segments and done_flush_segments,
    cleanup should proceed normally (queue entry removed, set deleted, etc).
    """
    spans = [
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id=None,
            segment_id=None,
            is_segment_span=True,
            project_id=1,
            end_timestamp=1700000000.0,
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


@override_options({**DEFAULT_OPTIONS, "spans.buffer.done-flush-conditional-zrem": True})
def test_done_flush_phase2_catches_race_after_zrem(buffer: SpansBuffer) -> None:
    """
    Test Phase 2 safety: even if Phase 1 (conditional ZREM) succeeds because the
    queue score hasn't been updated yet, Phase 2 (conditional data deletion)
    catches the race by detecting that the ingested count changed.

    This simulates the window where add-buffer.lua has run (adding spans and
    incrementing ic) but the ZADD hasn't happened yet.
    """
    initial_spans = [
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
        Span(
            payload=_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id=None,
            segment_id=None,
            is_segment_span=True,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
    ]
    process_spans(initial_spans, buffer, now=0)

    rv = buffer.flush_segments(now=11)
    assert len(rv) == 1
    segment_key = next(iter(rv))
    flushed_segment = rv[segment_key]

    # Simulate the race: add new spans (changes ic and queue score)
    new_spans = [
        Span(
            payload=_payload("c" * 16),
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="b" * 16,
            segment_id=None,
            project_id=1,
            end_timestamp=1700000000.0,
        ),
    ]
    process_spans(new_spans, buffer, now=20)

    # Now reset the queue score back to the original value, simulating the
    # window where add-buffer.lua ran but ZADD hasn't updated the score yet.
    # This means Phase 1 (conditional ZREM) will succeed.
    buffer.client.zadd(flushed_segment.queue_key, {segment_key: flushed_segment.score})

    # done_flush_segments: Phase 1 ZREM succeeds (score matches), but
    # Phase 2 should detect ic changed and skip data deletion.
    buffer.done_flush_segments(rv)

    # The segment data should still be in Redis
    # Restore the queue entry with a proper deadline so we can flush again
    buffer.client.zadd(flushed_segment.queue_key, {segment_key: 80})

    rv2 = buffer.flush_segments(now=81)
    assert len(rv2) == 1
    _normalize_output(rv2)
    flushed = rv2[segment_key]
    span_ids = sorted(span.payload["span_id"] for span in flushed.spans)
    assert "a" * 16 in span_ids
    assert "b" * 16 in span_ids
    assert "c" * 16 in span_ids

    # Clean up
    buffer.done_flush_segments(rv2)
    assert_clean(buffer.client)


# --- Distributed payload keys tests ---

DISTRIBUTED_PHASE_OPTIONS = {
    "phase1": {
        **DEFAULT_OPTIONS,
        "spans.buffer.write-distributed-payloads": True,
    },
    "phase2": {
        **DEFAULT_OPTIONS,
        "spans.buffer.write-distributed-payloads": True,
        "spans.buffer.read-distributed-payloads": True,
    },
    "phase3": {
        **DEFAULT_OPTIONS,
        "spans.buffer.write-distributed-payloads": True,
        "spans.buffer.read-distributed-payloads": True,
        "spans.buffer.write-merged-payloads": False,
    },
}


def _dspan(
    span_id: str,
    parent_span_id: str | None = None,
    is_root: bool = False,
    ts_offset: float = 0.0,
) -> Span:
    return Span(
        payload=_payload(span_id),
        trace_id="a" * 32,
        span_id=span_id,
        parent_span_id=parent_span_id,
        segment_id=None,
        is_segment_span=is_root,
        project_id=1,
        end_timestamp=1700000000.0 + ts_offset,
    )


@pytest.fixture(params=["phase1", "phase2", "phase3"])
def distributed_buffer(request):
    opts = DISTRIBUTED_PHASE_OPTIONS[request.param]
    with override_options(opts):
        buf = SpansBuffer(assigned_shards=list(range(32)))
        buf.client.flushdb()
        yield buf


def assert_clean_distributed(client: StrictRedis[bytes]):
    remaining = [x for x in client.keys("*") if b":hrs:" not in x]
    assert not remaining, f"Leaked keys: {remaining}"


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
    assert_clean_distributed(buf.client)


def test_distributed_multi_batch_merge(distributed_buffer: SpansBuffer) -> None:
    """Spans arrive in multiple batches, later batch discovers the root."""
    buf = distributed_buffer
    buf.process_spans([_dspan("a" * 16, "b" * 16)], now=0)
    buf.process_spans([_dspan("b" * 16, is_root=True, ts_offset=1)], now=1)
    assert_ttls(buf.client)

    rv = buf.flush_segments(now=12)
    seg_key = _segment_id(1, "a" * 32, "b" * 16)
    assert len(rv[seg_key].spans) == 2
    buf.done_flush_segments(rv)
    assert_clean_distributed(buf.client)


def test_distributed_deep_tree(distributed_buffer: SpansBuffer) -> None:
    """Chain d->c->b->a (root), each in a separate batch."""
    buf = distributed_buffer
    buf.process_spans([_dspan("d" * 16, "c" * 16, ts_offset=0)], now=0)
    buf.process_spans([_dspan("c" * 16, "b" * 16, ts_offset=1)], now=1)
    buf.process_spans([_dspan("b" * 16, "a" * 16, ts_offset=2)], now=2)
    buf.process_spans([_dspan("a" * 16, is_root=True, ts_offset=3)], now=3)

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
    assert_clean_distributed(buf.client)


def test_distributed_multiple_segments(distributed_buffer: SpansBuffer) -> None:
    """Two independent segments in the same trace."""
    buf = distributed_buffer
    process_spans([_dspan("a" * 16, is_root=True), _dspan("b" * 16, is_root=True)], buf, now=0)
    rv = buf.flush_segments(now=11)
    assert len(rv) == 2
    buf.done_flush_segments(rv)
    assert_clean_distributed(buf.client)


def test_distributed_phase1_dual_write() -> None:
    """Both merged and distributed keys are populated during dual-write."""
    with override_options(DISTRIBUTED_PHASE_OPTIONS["phase1"]):
        buf = SpansBuffer(assigned_shards=list(range(32)))
        buf.client.flushdb()
        process_spans([_dspan("a" * 16, "b" * 16), _dspan("b" * 16, is_root=True)], buf, now=0)

        set_key = _segment_id(1, "a" * 32, "b" * 16)
        dist_key = b"span-buf:s:{1:" + b"a" * 32 + b":" + b"b" * 16 + b"}:" + b"b" * 16
        mk_key = b"span-buf:mk:{1:" + b"a" * 32 + b"}:" + b"b" * 16
        assert buf.client.scard(set_key) > 0
        assert buf.client.scard(dist_key) > 0
        assert buf.client.scard(mk_key) > 0

        rv = buf.flush_segments(now=11)
        assert len(rv[set_key].spans) == 2
        buf.done_flush_segments(rv)


def test_distributed_phase3_no_merged_write() -> None:
    """Merged key is not populated when write-merged-payloads is off."""
    with override_options(DISTRIBUTED_PHASE_OPTIONS["phase3"]):
        buf = SpansBuffer(assigned_shards=list(range(32)))
        buf.client.flushdb()
        process_spans([_dspan("a" * 16, "b" * 16), _dspan("b" * 16, is_root=True)], buf, now=0)
        set_key = _segment_id(1, "a" * 32, "b" * 16)
        assert buf.client.scard(set_key) == 0


def test_distributed_transition_write_then_read() -> None:
    """Write with dual-write on, flush with read-distributed on — no data loss."""
    with override_options(DISTRIBUTED_PHASE_OPTIONS["phase1"]):
        buf = SpansBuffer(assigned_shards=list(range(32)))
        buf.client.flushdb()
        buf.process_spans([_dspan("a" * 16, "b" * 16), _dspan("b" * 16, is_root=True)], now=0)

    with override_options(DISTRIBUTED_PHASE_OPTIONS["phase2"]):
        rv = buf.flush_segments(now=11)
        seg_key = _segment_id(1, "a" * 32, "b" * 16)
        assert len(rv[seg_key].spans) == 2
        buf.done_flush_segments(rv)
        assert_clean_distributed(buf.client)
