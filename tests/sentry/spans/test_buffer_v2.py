from __future__ import annotations

import itertools

import pytest
import rapidjson
from sentry_redis_tools.clients import StrictRedis

from sentry.spans.buffer_v2 import RedisSpansBufferV2, SegmentId, Span


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentId:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _payload(span_id: bytes) -> bytes:
    return rapidjson.dumps({"span_id": span_id}).encode("ascii")


@pytest.fixture(params=["cluster", "single"])
def buffer(request):
    if request.param == "cluster":
        from sentry.testutils.helpers.redis import use_redis_cluster

        with use_redis_cluster("default"):
            buf = RedisSpansBufferV2(assigned_shards=list(range(32)))
            # since we patch the default redis cluster only temporarily, we
            # need to clean it up ourselves.
            buf.client.flushall()
            yield buf
    else:
        yield RedisSpansBufferV2(assigned_shards=list(range(32)))


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


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload(b"a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id=None,
                    project_id=1,
                ),
            ]
        )
    ),
)
def test_basic(buffer: RedisSpansBufferV2, spans):
    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == (1, {})
    _, rv = buffer.flush_segments(now=11)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): {
            _payload(b"d" * 16),
            _payload(b"b" * 16),
            _payload(b"a" * 16),
            _payload(b"c" * 16),
        }
    }
    buffer.done_flush_segments(rv)
    assert buffer.flush_segments(now=30) == (0, {})

    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload(b"d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id="a" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id=None,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="a" * 16,
                    project_id=1,
                ),
            ]
        )
    ),
)
def test_deep(buffer: RedisSpansBufferV2, spans):
    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    _, rv = buffer.flush_segments(now=10)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): {
            _payload(b"d" * 16),
            _payload(b"b" * 16),
            _payload(b"a" * 16),
            _payload(b"c" * 16),
        }
    }

    buffer.done_flush_segments(rv)

    _, rv = buffer.flush_segments(now=60)
    assert rv == {}

    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload(b"e" * 16),
                    trace_id="a" * 32,
                    span_id="e" * 16,
                    parent_span_id="d" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id="c" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="a" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id=None,
                    project_id=1,
                ),
            ]
        )
    ),
)
def test_deep2(buffer: RedisSpansBufferV2, spans):
    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    _, rv = buffer.flush_segments(now=10)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): {
            _payload(b"a" * 16),
            _payload(b"b" * 16),
            _payload(b"c" * 16),
            _payload(b"d" * 16),
            _payload(b"e" * 16),
        }
    }

    buffer.done_flush_segments(rv)

    _, rv = buffer.flush_segments(now=60)
    assert rv == {}

    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload(b"c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"e" * 16),
                    trace_id="a" * 32,
                    span_id="e" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id=None,
                    project_id=2,
                ),
            ]
        )
    ),
)
def test_parent_in_other_project(buffer: RedisSpansBufferV2, spans):
    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == (2, {})
    _, rv = buffer.flush_segments(now=11)
    assert rv == {_segment_id(2, "a" * 32, "b" * 16): {_payload(b"b" * 16)}}
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == (1, {})
    _, rv = buffer.flush_segments(now=60)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): {
            _payload(b"c" * 16),
            _payload(b"d" * 16),
            _payload(b"e" * 16),
        }
    }
    buffer.done_flush_segments(rv)

    assert buffer.flush_segments(now=90) == (0, {})

    assert_clean(buffer.client)
