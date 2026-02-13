from __future__ import annotations

import itertools
from collections.abc import Sequence
from unittest import mock

import orjson
import pytest
from sentry_redis_tools.clients import StrictRedis

from sentry import options
from sentry.spans.buffer import FlushedSegment, OutputSpan, SegmentKey, Span, SpansBuffer
from sentry.testutils.helpers.options import override_options

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
    "spans.buffer.compression.level": 0,
    "spans.buffer.pipeline-batch-size": 0,
    "spans.buffer.max-spans-per-evalsha": 0,
    "spans.buffer.evalsha-latency-threshold": 100,
    "spans.buffer.debug-traces": [],
    "spans.buffer.write-to-set": True,
    "spans.buffer.read-from-set": True,
    "spans.buffer.write-to-payload-set": False,
    "spans.buffer.read-from-payload-set": False,
    "spans.buffer.payload-cutoff-size": 1024,
    "spans.buffer.evalsha-cumulative-logger-enabled": True,
}


def shallow_permutations(spans: list[Span]) -> list[list[Span]]:
    return [
        spans,
        list(reversed(spans)),
        [span_or_split for span in spans for span_or_split in [span, _SplitBatch()]],  # type: ignore[misc]
    ]


def _set_segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return _set_segment_id(project_id, trace_id, span_id)


def _payload_set_segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return f"span-buf:p:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _segment_id_for_config(
    project_id: int,
    trace_id: str,
    span_id: str,
) -> SegmentKey:
    if options.get("spans.buffer.read-from-payload-set"):
        return _payload_set_segment_id(project_id, trace_id, span_id)
    return _set_segment_id(project_id, trace_id, span_id)


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
def buffer(request, dual_write_config):
    redis_type, max_spans_per_evalsha = request.param
    test_options = {
        **DEFAULT_OPTIONS,
        "spans.buffer.max-spans-per-evalsha": max_spans_per_evalsha,
        **dual_write_config,
    }
    with override_options(test_options):
        if redis_type == "cluster":
            from sentry.testutils.helpers.redis import use_redis_cluster

            with use_redis_cluster("default"):
                buf = SpansBuffer(assigned_shards=list(range(32)))
                # since we patch the default redis cluster only temporarily, we
                # need to clean it up ourselves.
                buf.client.flushall()
                yield buf
        else:
            buf = SpansBuffer(assigned_shards=list(range(32)))
            buf.client.flushdb()
            yield buf


@pytest.fixture(
    params=[
        # Write to set, Read from set, Write to payload set, Read from payload set
        pytest.param((True, True, False, False), id="orig-write-orig-read"),
        pytest.param((True, True, True, False), id="dual-write-orig-read"),
        pytest.param((True, False, True, True), id="dual-write-payload-read"),
        pytest.param((False, False, True, True), id="payload-write-and-payload-read"),
    ]
)
def dual_write_config(request):
    write_to_set, read_from_set, write_to_payload_set, read_from_payload_set = request.param
    yield {
        "spans.buffer.write-to-set": write_to_set,
        "spans.buffer.read-from-set": read_from_set,
        "spans.buffer.write-to-payload-set": write_to_payload_set,
        "spans.buffer.read-from-payload-set": read_from_payload_set,
    }


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


class TestSpansBuffer:
    """Tests that use the buffer fixture (which applies dual_write_config)."""

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
    def test_basic(self, buffer: SpansBuffer, spans) -> None:
        process_spans(spans, buffer, now=0)

        assert_ttls(buffer.client)

        assert buffer.flush_segments(now=5) == {}
        rv = buffer.flush_segments(now=11)
        _normalize_output(rv)
        segment_key = _segment_id_for_config(1, "a" * 32, "b" * 16)
        assert rv == {
            segment_key: FlushedSegment(
                queue_key=mock.ANY,
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
        self,
        emit_observability_metrics: mock.MagicMock,
        buffer: SpansBuffer,
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
        segment_key = _segment_id_for_config(1, "a" * 32, "b" * 16)
        assert rv == {
            segment_key: FlushedSegment(
                queue_key=mock.ANY,
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
        emit_observability_metrics.assert_called()  # If writing to multiple places, it's called more than once

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
    def test_deep(self, buffer: SpansBuffer, spans) -> None:
        process_spans(spans, buffer, now=0)

        assert_ttls(buffer.client)

        rv = buffer.flush_segments(now=10)
        _normalize_output(rv)
        segment_key = _segment_id_for_config(1, "a" * 32, "a" * 16)
        assert rv == {
            segment_key: FlushedSegment(
                queue_key=mock.ANY,
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
    def test_deep_pipeline_batch_size(self, buffer: SpansBuffer, spans) -> None:
        """Like test_deep but with pipeline-batch-size=2 to exercise batch splitting."""
        with override_options({"spans.buffer.pipeline-batch-size": 2}):
            process_spans(spans, buffer, now=0)

            assert_ttls(buffer.client)

            rv = buffer.flush_segments(now=10)
            _normalize_output(rv)
            segment_key = _segment_id_for_config(1, "a" * 32, "a" * 16)
            assert rv == {
                segment_key: FlushedSegment(
                    queue_key=mock.ANY,
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
    def test_deep2(self, buffer: SpansBuffer, spans) -> None:
        process_spans(spans, buffer, now=0)

        assert_ttls(buffer.client)

        rv = buffer.flush_segments(now=10)
        _normalize_output(rv)
        segment_key = _segment_id_for_config(1, "a" * 32, "a" * 16)
        assert rv == {
            segment_key: FlushedSegment(
                queue_key=mock.ANY,
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
    def test_parent_in_other_project(self, buffer: SpansBuffer, spans) -> None:
        process_spans(spans, buffer, now=0)

        assert_ttls(buffer.client)

        assert buffer.flush_segments(now=5) == {}
        rv = buffer.flush_segments(now=11)
        segment_key_2 = _segment_id_for_config(2, "a" * 32, "b" * 16)
        assert rv == {
            segment_key_2: FlushedSegment(
                queue_key=mock.ANY, spans=[_output_segment(b"b" * 16, b"b" * 16, True)]
            )
        }
        buffer.done_flush_segments(rv)

        # TODO: flush faster, since we already saw parent in other project
        assert buffer.flush_segments(now=30) == {}
        rv = buffer.flush_segments(now=60)
        _normalize_output(rv)
        segment_key_1 = _segment_id_for_config(1, "a" * 32, "b" * 16)
        assert rv == {
            segment_key_1: FlushedSegment(
                queue_key=mock.ANY,
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
    def test_parent_in_other_project_and_nested_is_segment_span(
        self, buffer: SpansBuffer, spans
    ) -> None:
        process_spans(spans, buffer, now=0)

        assert_ttls(buffer.client)

        assert buffer.flush_segments(now=5) == {}
        rv = buffer.flush_segments(now=11)
        segment_key_2 = _segment_id_for_config(2, "a" * 32, "b" * 16)
        segment_key_1c = _segment_id_for_config(1, "a" * 32, "c" * 16)
        assert rv == {
            segment_key_2: FlushedSegment(
                queue_key=mock.ANY, spans=[_output_segment(b"b" * 16, b"b" * 16, True)]
            ),
            segment_key_1c: FlushedSegment(
                queue_key=mock.ANY,
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
        segment_key_1b = _segment_id_for_config(1, "a" * 32, "b" * 16)
        assert rv == {
            segment_key_1b: FlushedSegment(
                queue_key=mock.ANY,
                spans=[
                    _output_segment(b"d" * 16, b"b" * 16, False),
                    _output_segment(b"e" * 16, b"b" * 16, False),
                ],
            ),
        }

        buffer.done_flush_segments(rv)

        assert buffer.flush_segments(now=90) == {}

        assert_clean(buffer.client)

    def test_flush_rebalance(self, buffer: SpansBuffer) -> None:
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
        segment_key = _segment_id_for_config(1, "a" * 32, "a" * 16)
        assert rv == {
            segment_key: FlushedSegment(
                queue_key=mock.ANY, spans=[_output_segment(b"a" * 16, b"a" * 16, True)]
            ),
        }

        # Clear out assigned shards, simulating a rebalance operation.
        buffer.assigned_shards.clear()
        buffer.done_flush_segments(rv)

        rv = buffer.flush_segments(now=20)
        assert not rv

        assert_clean(buffer.client)

    @mock.patch("sentry.spans.buffer.Project")
    def test_max_segment_spans_limit(self, mock_project_model, buffer: SpansBuffer) -> None:
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

        with override_options({"spans.buffer.max-segment-bytes": 200}):
            buffer.process_spans(batch1, now=0)
            buffer.process_spans(batch2, now=0)
            rv = buffer.flush_segments(now=11)

        segment_key = _segment_id_for_config(1, "a" * 32, "a" * 16)
        segment = rv[segment_key]
        retained_span_ids = {span.payload["span_id"] for span in segment.spans}

        # Some spans should be evicted because the segment is too large.
        all_span_ids = {"a" * 16, "b" * 16, "c" * 16, "d" * 16, "e" * 16}
        assert len(retained_span_ids) < len(all_span_ids), "Some spans should have been evicted"
        assert retained_span_ids.issubset(all_span_ids)

        # NB: We currently accept that we leak redirect keys when we limit segments.
        # buffer.done_flush_segments(rv)
        # assert_clean(buffer.client)

    @mock.patch("sentry.spans.buffer.Project")
    @mock.patch("sentry.spans.buffer.track_outcome")
    @mock.patch("sentry.spans.buffer.metrics.timing")
    def test_dropped_spans_emit_outcomes(
        self,
        mock_metrics,
        mock_track_outcome,
        mock_project_model,
        buffer: SpansBuffer,
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
        with override_options({"spans.buffer.max-segment-bytes": 200}):
            buffer.process_spans(batch1, now=0)
            buffer.process_spans(batch2, now=0)
            buffer.flush_segments(now=11)

        # Verify that track_outcome was called
        assert mock_track_outcome.called, "track_outcome should be called when spans are dropped"

        # Find the call with INVALID outcome
        outcome_calls = [
            c
            for c in mock_track_outcome.call_args_list
            if c.kwargs.get("outcome") == Outcome.INVALID
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
            c
            for c in mock_metrics.call_args_list
            if c.args and c.args[0] == "spans.buffer.flush_segments.ingested_spans_per_segment"
        ]
        assert len(ingested_spans_timing_calls) == 1, (
            "Should emit ingested_spans_per_segment metric"
        )
        assert ingested_spans_timing_calls[0].args[1] == 6, "Should have ingested 6 spans"

        ingested_bytes_timing_calls = [
            c
            for c in mock_metrics.call_args_list
            if c.args and c.args[0] == "spans.buffer.flush_segments.ingested_bytes_per_segment"
        ]
        assert len(ingested_bytes_timing_calls) == 1, (
            "Should emit ingested_bytes_per_segment metric"
        )
        assert ingested_bytes_timing_calls[0].args[1] == expected_bytes

    def test_preassigned_disconnected_segment(self, buffer: SpansBuffer) -> None:
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
        segment_key = _segment_id_for_config(1, "a" * 32, "a" * 16)
        assert rv == {
            segment_key: FlushedSegment(
                queue_key=mock.ANY,
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


def test_kafka_slice_id() -> None:
    """Test that slice_id is used in queue keys. Uses its own buffer, not the fixture."""
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


# ============================================================================
# SET to payload SET migration tests
# ============================================================================


def test_dual_write_payload_set_content_matches() -> None:
    opts = {
        **DEFAULT_OPTIONS,
        "spans.buffer.write-to-set": True,
        "spans.buffer.read-from-set": True,
        "spans.buffer.write-to-payload-set": True,
        "spans.buffer.payload-cutoff-size": 1,
        # "spans.buffer.compression.level": compression_level,
    }
    with override_options(opts):
        buffer = SpansBuffer(assigned_shards=list(range(32)))
        buffer.client.flushdb()

        project_id = 1
        trace_id = "a" * 32
        project_and_trace = f"{project_id}:{trace_id}"
        key1, key2, key3 = "a" * 16, "b" * 16, "c" * 16
        spans = [
            Span(
                payload=_payload(key1),
                trace_id=trace_id,
                span_id=key1,
                parent_span_id=key2,
                segment_id=None,
                project_id=project_id,
                end_timestamp=1700000000.0,
            ),
            Span(
                payload=_payload(key2),
                trace_id=trace_id,
                span_id=key2,
                parent_span_id=None,
                segment_id=None,
                is_segment_span=True,
                project_id=project_id,
                end_timestamp=1700000000.0,
            ),
            Span(
                payload=_payload(key3),
                trace_id=trace_id,
                span_id=key3,
                parent_span_id=key2,
                segment_id=None,
                project_id=project_id,
                end_timestamp=1700000000.0,
            ),
        ]

        process_spans(spans, buffer, now=0)

        set_key = f"span-buf:s:{{{project_and_trace}}}:{key2}".encode("ascii")
        payload_set_key = f"span-buf:p:{{{project_and_trace}}}:{key2}".encode("ascii")
        set_members = buffer.client.smembers(set_key)
        payload_set_members = buffer.client.smembers(payload_set_key)

        assert len(payload_set_members) == len(set_members)
        assert len(payload_set_members) > 0

        span_ids = set()
        for payload in set_members:
            for decompressed in buffer._decompress_batch(payload):
                span_data = orjson.loads(decompressed)
                span_ids.add(span_data["span_id"])

        assert span_ids == {"a" * 16, "b" * 16, "c" * 16}

        span_id_payload_keys = set()
        for payload in payload_set_members:
            span_id_payload_keys.add(payload)

        assert span_id_payload_keys == {
            buffer._get_payload_key(project_and_trace, key2),
        }

        payload_members = buffer.client.smembers(buffer._get_payload_key(project_and_trace, key2))
        span_payloads = set()
        for payload in payload_members:
            for decompressed in buffer._decompress_batch(payload):
                span_data = orjson.loads(decompressed)
                span_payloads.add(span_data["span_id"])

        assert span_payloads == {"a" * 16, "b" * 16, "c" * 16}


def test_dual_write_separate_redirect_tables_payload_set() -> None:
    """Test that SET and payload SET use separate redirect tables that contain equivalent mappings."""
    opts = {
        **DEFAULT_OPTIONS,
        "spans.buffer.write-to-set": True,
        "spans.buffer.read-from-set": True,
        "spans.buffer.write-to-payload-set": True,
        "spans.buffer.payload-cutoff-size": 1,
    }
    with override_options(opts):
        buffer = SpansBuffer(assigned_shards=list(range(32)))
        buffer.client.flushdb()

        # Create spans where child arrives before parent to exercise redirect logic
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

        # Verify separate redirect tables exist
        set_redirect_key = f"span-buf:ssr:{{1:{'a' * 32}}}".encode("ascii")
        payload_set_redirect_key = f"span-buf:psr:{{1:{'a' * 32}}}".encode("ascii")

        set_redirects = buffer.client.hgetall(set_redirect_key)
        payload_set_redirects = buffer.client.hgetall(payload_set_redirect_key)

        # Both should have redirect entries
        assert len(set_redirects) > 0, "SET redirect table should have entries"
        assert len(payload_set_redirects) > 0, "Payload SET redirect table should have entries"

        # Both should have equivalent mappings (same span_id -> parent_span_id)
        assert set_redirects == payload_set_redirects, (
            "SET and payload SET redirect tables should have equivalent mappings"
        )

        # Flush and verify cleanup
        rv = buffer.flush_segments(now=11)
        buffer.done_flush_segments(rv)

        # Both redirect tables should be cleaned up
        set_redirects_after = buffer.client.hgetall(set_redirect_key)
        payload_set_redirects_after = buffer.client.hgetall(payload_set_redirect_key)
        assert len(set_redirects_after) == 0, "SET redirect table should be cleaned up"
        assert len(payload_set_redirects_after) == 0, (
            "Payload SET redirect table should be cleaned up"
        )

        assert_clean(buffer.client)


@mock.patch("sentry.spans.buffer.emit_observability_metrics")
def test_dual_write_emits_set_metrics_payload_set(
    emit_observability_metrics: mock.MagicMock,
) -> None:
    """Test that payload SET-specific metrics are emitted when writing to payload set."""
    opts = {
        **DEFAULT_OPTIONS,
        "spans.buffer.write-to-set": True,
        "spans.buffer.read-from-set": True,
        "spans.buffer.write-to-payload-set": True,
        "spans.buffer.payload-cutoff-size": 1,
    }
    with override_options(opts):
        buffer = SpansBuffer(assigned_shards=list(range(32)))
        buffer.client.flushdb()

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

        assert emit_observability_metrics.call_count == 2

        set_call = emit_observability_metrics.call_args_list[0]
        set_latency_metrics = set_call.args[0]
        assert len(set_latency_metrics) > 0
        for metric_list in set_latency_metrics:
            for metric_name, _ in metric_list:
                assert not metric_name.decode().startswith("payload_set_")

        payload_set_call = emit_observability_metrics.call_args_list[1]
        payload_set_latency_metrics = payload_set_call.args[0]
        assert len(payload_set_latency_metrics) > 0
        for metric_list in payload_set_latency_metrics:
            for metric_name, _ in metric_list:
                assert metric_name.decode().startswith("payload_set_")
