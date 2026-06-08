from __future__ import annotations

from typing import Any

import pytest
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.spans.buffer import SpansBuffer, add_buffer_script
from sentry.spans.segment_key import SegmentKey

pytestmark = [pytest.mark.django_db]


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _members_key(project_id: int, trace_id: str, span_id: str) -> bytes:
    return f"span-buf:mk:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _redirect_key(project_id: int, trace_id: str) -> bytes:
    return f"span-buf:ssr:{{{project_id}:{trace_id}}}".encode("ascii")


def _ingested_count_key(segment_key: bytes) -> bytes:
    return b"span-buf:ic:" + segment_key


def _ingested_byte_count_key(segment_key: bytes) -> bytes:
    return b"span-buf:ibc:" + segment_key


def _has_root_span_key(segment_key: bytes) -> bytes:
    return b"span-buf:hrs:" + segment_key


@pytest.fixture
def redis_client() -> StrictRedis[bytes] | RedisCluster[bytes]:
    buf = SpansBuffer(assigned_shards=list(range(32)))
    buf.client.flushdb()
    yield buf.client


def eval_add_buffer_script(
    client: StrictRedis[bytes] | RedisCluster[bytes],
    *,
    project_and_trace: str,
    parent_span_id: str,
    span_ids: list[str],
    salt: str,
    has_root_span: bool = False,
    set_timeout: int = 60,
    byte_count: int = 0,
    max_segment_bytes: int = 0,
    check_flush_lock: bool = False,
) -> list[Any]:
    sha = client.script_load(add_buffer_script.script)
    return client.execute_command(
        "EVALSHA",
        sha,
        1,
        project_and_trace,
        len(span_ids),
        parent_span_id,
        "true" if has_root_span else "false",
        set_timeout,
        byte_count,
        max_segment_bytes,
        salt,
        "true" if check_flush_lock else "false",
        *span_ids,
    )


def _metrics_table(result: list[Any]) -> dict[bytes, int]:
    return dict(result[4])


def test_creates_segment_metadata(redis_client: StrictRedis[bytes] | RedisCluster[bytes]) -> None:
    trace_id = "a" * 32
    project_and_trace = f"1:{trace_id}"
    root_span_id = "b" * 16
    child_span_id = "a" * 16
    salt = "salt-root"
    segment_key = _segment_id(1, trace_id, root_span_id)

    result = eval_add_buffer_script(
        redis_client,
        project_and_trace=project_and_trace,
        parent_span_id=root_span_id,
        span_ids=[root_span_id, child_span_id],
        salt=salt,
        has_root_span=True,
        byte_count=23,
    )

    assert result[0] == segment_key
    assert result[1] == 1
    assert result[2] >= 0
    assert _metrics_table(result)[b"detached_segment_too_large"] == 0
    assert _metrics_table(result)[b"detached_segment_locked"] == 0

    assert redis_client.hgetall(_redirect_key(1, trace_id)) == {
        root_span_id.encode(): root_span_id.encode(),
        child_span_id.encode(): root_span_id.encode(),
    }
    assert redis_client.smembers(_members_key(1, trace_id, root_span_id)) == {salt.encode()}
    assert redis_client.get(_ingested_count_key(segment_key)) == b"2"
    assert redis_client.get(_ingested_byte_count_key(segment_key)) == b"23"
    assert redis_client.get(_has_root_span_key(segment_key)) == b"1"

    assert redis_client.ttl(_redirect_key(1, trace_id)) > 0
    assert redis_client.ttl(_members_key(1, trace_id, root_span_id)) > 0
    assert redis_client.ttl(_ingested_count_key(segment_key)) > 0
    assert redis_client.ttl(_ingested_byte_count_key(segment_key)) > 0
    assert redis_client.ttl(_has_root_span_key(segment_key)) > 0


def test_merges_existing_child_segment(
    redis_client: StrictRedis[bytes] | RedisCluster[bytes],
) -> None:
    trace_id = "b" * 32
    project_and_trace = f"1:{trace_id}"
    root_span_id = "a" * 16
    child_span_id = "b" * 16
    leaf_span_id = "c" * 16
    child_segment_key = _segment_id(1, trace_id, child_span_id)
    root_segment_key = _segment_id(1, trace_id, root_span_id)

    eval_add_buffer_script(
        redis_client,
        project_and_trace=project_and_trace,
        parent_span_id=child_span_id,
        span_ids=[leaf_span_id],
        salt="salt-leaf",
        byte_count=11,
    )
    result = eval_add_buffer_script(
        redis_client,
        project_and_trace=project_and_trace,
        parent_span_id=root_span_id,
        span_ids=[child_span_id],
        salt="salt-child",
        byte_count=13,
    )

    assert result[0] == root_segment_key
    assert redis_client.smembers(_members_key(1, trace_id, root_span_id)) == {
        b"salt-child",
        b"salt-leaf",
    }
    assert redis_client.exists(_members_key(1, trace_id, child_span_id)) == 0
    assert redis_client.exists(_ingested_count_key(child_segment_key)) == 0
    assert redis_client.exists(_ingested_byte_count_key(child_segment_key)) == 0
    assert redis_client.get(_ingested_count_key(root_segment_key)) == b"2"
    assert redis_client.get(_ingested_byte_count_key(root_segment_key)) == b"24"
    assert redis_client.hgetall(_redirect_key(1, trace_id)) == {
        leaf_span_id.encode(): child_span_id.encode(),
        child_span_id.encode(): root_span_id.encode(),
    }


def test_merges_large_child_member_key_set(
    redis_client: StrictRedis[bytes] | RedisCluster[bytes],
) -> None:
    trace_id = "e" * 32
    project_and_trace = f"1:{trace_id}"
    root_span_id = "a" * 16
    child_span_id = "b" * 16
    child_segment_key = _segment_id(1, trace_id, child_span_id)
    root_segment_key = _segment_id(1, trace_id, root_span_id)
    child_members_key = _members_key(1, trace_id, child_span_id)
    root_members_key = _members_key(1, trace_id, root_span_id)
    child_member_count = 9000
    child_members = [f"salt-{i}".encode() for i in range(child_member_count)]

    redis_client.sadd(child_members_key, *child_members)
    redis_client.set(_ingested_count_key(child_segment_key), child_member_count)
    redis_client.set(_ingested_byte_count_key(child_segment_key), 123)

    result = eval_add_buffer_script(
        redis_client,
        project_and_trace=project_and_trace,
        parent_span_id=root_span_id,
        span_ids=[child_span_id],
        salt="salt-parent",
        byte_count=7,
    )

    assert result[0] == root_segment_key
    assert redis_client.exists(child_members_key) == 0
    assert redis_client.scard(root_members_key) == child_member_count + 1
    assert redis_client.sismember(root_members_key, b"salt-0") == 1
    assert redis_client.sismember(root_members_key, b"salt-8999") == 1
    assert redis_client.sismember(root_members_key, b"salt-parent") == 1
    assert redis_client.get(_ingested_count_key(root_segment_key)) == b"9001"
    assert redis_client.get(_ingested_byte_count_key(root_segment_key)) == b"130"
    assert redis_client.exists(_ingested_count_key(child_segment_key)) == 0
    assert redis_client.exists(_ingested_byte_count_key(child_segment_key)) == 0


def test_detaches_when_segment_exceeds_byte_limit(
    redis_client: StrictRedis[bytes] | RedisCluster[bytes],
) -> None:
    trace_id = "c" * 32
    project_and_trace = f"1:{trace_id}"
    root_span_id = "a" * 16
    first_span_id = "b" * 16
    second_span_id = "c" * 16
    normal_segment_key = _segment_id(1, trace_id, root_span_id)
    detached_segment_key = _segment_id(1, trace_id, "salt-second")

    eval_add_buffer_script(
        redis_client,
        project_and_trace=project_and_trace,
        parent_span_id=root_span_id,
        span_ids=[first_span_id],
        salt="salt-first",
        byte_count=40,
    )
    result = eval_add_buffer_script(
        redis_client,
        project_and_trace=project_and_trace,
        parent_span_id=root_span_id,
        span_ids=[second_span_id],
        salt="salt-second",
        byte_count=30,
        max_segment_bytes=60,
    )

    assert result[0] == detached_segment_key
    assert _metrics_table(result)[b"detached_segment_too_large"] == 1
    assert _metrics_table(result)[b"detached_segment_locked"] == 0
    assert redis_client.smembers(_members_key(1, trace_id, root_span_id)) == {b"salt-first"}
    assert redis_client.smembers(_members_key(1, trace_id, "salt-second")) == {b"salt-second"}
    assert redis_client.get(_ingested_byte_count_key(normal_segment_key)) == b"40"
    assert redis_client.get(_ingested_byte_count_key(detached_segment_key)) == b"30"


def test_detaches_when_segment_is_flush_locked(
    redis_client: StrictRedis[bytes] | RedisCluster[bytes],
) -> None:
    trace_id = "d" * 32
    project_and_trace = f"1:{trace_id}"
    root_span_id = "a" * 16
    first_span_id = "b" * 16
    second_span_id = "c" * 16
    normal_segment_key = _segment_id(1, trace_id, root_span_id)
    detached_segment_key = _segment_id(1, trace_id, "salt-locked")

    eval_add_buffer_script(
        redis_client,
        project_and_trace=project_and_trace,
        parent_span_id=root_span_id,
        span_ids=[first_span_id],
        salt="salt-first",
        byte_count=10,
    )
    redis_client.set(b"span-buf:fl:" + normal_segment_key, b"1", ex=60)
    result = eval_add_buffer_script(
        redis_client,
        project_and_trace=project_and_trace,
        parent_span_id=root_span_id,
        span_ids=[second_span_id],
        salt="salt-locked",
        byte_count=10,
        check_flush_lock=True,
    )

    assert result[0] == detached_segment_key
    assert _metrics_table(result)[b"detached_segment_too_large"] == 0
    assert _metrics_table(result)[b"detached_segment_locked"] == 1
    assert redis_client.smembers(_members_key(1, trace_id, root_span_id)) == {b"salt-first"}
    assert redis_client.smembers(_members_key(1, trace_id, "salt-locked")) == {b"salt-locked"}
