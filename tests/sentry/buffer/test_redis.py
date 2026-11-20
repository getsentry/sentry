import datetime
import pickle
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager
from typing import Any, cast
from unittest import mock
from zlib import crc32

import pytest
from django.utils import timezone
from redis import StrictRedis
from redis.exceptions import ConnectionError as RedisConnectionError
from sentry_redis_tools.clients import RedisCluster

from sentry.buffer.base import Buffer, BufferField
from sentry.buffer.redis import PENDING_SLICES, RedisBuffer, _coerce_val, make_key
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.tasks.process_buffer import process_incr
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json
from sentry.utils.concurrent import SynchronousExecutor
from sentry.utils.services import Delegator


def _hgetall_decode_keys(
    client: "RedisCluster[bytes] | StrictRedis[bytes]", key: str
) -> dict[str, bytes]:
    return {k.decode(): v for k, v in client.hgetall(key).items()}


@pytest.mark.django_db
class TestRedisBuffer:
    @pytest.fixture(params=["cluster", "standalone"])
    def buffer(self, request: pytest.FixtureRequest) -> Iterator[RedisBuffer]:
        # `cluster` is a real Redis Cluster with `is_redis_cluster`, and `default` is a single
        # host. Use each entry as it is configured: a client is cached by cluster name only, so
        # a changed entry can get a client of the wrong shape from the cache, or leave one there.
        if request.param == "cluster":
            buf = RedisBuffer(cluster="cluster")
            assert buf.is_redis_cluster
            # The client deletes only the keys with the key prefix of this worker.
            buf.cluster.flushdb()
        else:
            buf = RedisBuffer()
            assert not buf.is_redis_cluster
        yield buf

    @pytest.fixture(autouse=True)
    def setup_buffer(self, buffer: RedisBuffer) -> None:
        self.buf = buffer

    def test_coerce_val_handles_foreignkeys(self) -> None:
        assert _coerce_val(Project(id=1)) == b"1"

    def test_coerce_val_handles_unicode(self) -> None:
        assert _coerce_val("\u201d") == "\u201d".encode()

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.redis.process_incr")
    def test_process_pending_one_batch(self, process_incr: mock.MagicMock) -> None:
        self.buf.incr_batch_size = 5
        client = self.buf.cluster
        client.zadd("b:p", {"foo": 1, "bar": 2})
        self.buf.process_pending()
        assert len(process_incr.apply_async.mock_calls) == 1
        assert process_incr.apply_async.mock_calls == [
            mock.call(kwargs={"batch_keys": ["foo", "bar"]}, headers=mock.ANY)
        ]
        client = self.buf.cluster
        assert client.zrange("b:p", 0, -1) == []

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.redis.process_incr")
    def test_process_pending_multiple_batches(self, process_incr: mock.MagicMock) -> None:
        self.buf.incr_batch_size = 2
        client = self.buf.cluster
        client.zadd("b:p", {"foo": 1, "bar": 2, "baz": 3})
        self.buf.process_pending()
        assert len(process_incr.apply_async.mock_calls) == 2
        process_incr.apply_async.assert_any_call(
            kwargs={"batch_keys": ["foo", "bar"]}, headers=mock.ANY
        )
        process_incr.apply_async.assert_any_call(kwargs={"batch_keys": ["baz"]}, headers=mock.ANY)
        client = self.buf.cluster
        assert client.zrange("b:p", 0, -1) == []

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_process_does_bubble_up_json(self, process: mock.MagicMock) -> None:
        client = self.buf.cluster

        client.hmset(
            "foo",
            {
                "e+foo": '["s","bar"]',
                "e+datetime": '["dt","1493791566.000000"]',
                "f": '{"pk": ["i","1"]}',
                "i+times_seen": "2",
                "m": "sentry.models.Group",
            },
        )
        columns = {"times_seen": 2}
        filters = {"pk": 1}
        extra = {
            "foo": "bar",
            "datetime": datetime.datetime(2017, 5, 3, 6, 6, 6, tzinfo=datetime.UTC),
        }
        signal_only = None
        self.buf.process("foo")
        process.assert_called_once_with(Group, columns, filters, extra, signal_only)

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_process_does_bubble_up_pickle(self, process: mock.MagicMock) -> None:
        client = self.buf.cluster

        client.hmset(
            "foo",
            {
                "e+foo": "S'bar'\np1\n.",
                "f": "(dp1\nS'pk'\np2\nI1\ns.",
                "i+times_seen": "2",
                "m": "sentry.models.Group",
            },
        )
        columns = {"times_seen": 2}
        filters = {"pk": 1}
        extra = {"foo": "bar"}
        signal_only = None
        self.buf.process("foo")
        process.assert_called_once_with(Group, columns, filters, extra, signal_only)

    @django_db_all
    @freeze_time()
    def test_group_cache_updated(
        self, default_group: Group, task_runner: Callable[[], AbstractContextManager[None]]
    ) -> None:
        # Make sure group is stored in the cache and keep track of times_seen at the time
        orig_times_seen = Group.objects.get_from_cache(id=default_group.id).times_seen
        times_seen_incr = 5
        self.buf.incr(
            Group,
            {"times_seen": times_seen_incr},
            {"pk": default_group.id},
            {"last_seen": timezone.now()},
        )
        with task_runner(), mock.patch("sentry.buffer.backend", self.buf):
            self.buf.process_pending()
        group = Group.objects.get_from_cache(id=default_group.id)
        assert group.times_seen == orig_times_seen + times_seen_incr

    @django_db_all
    def test_process_incr_through_delegator(self, default_group: Group) -> None:
        delegator = Delegator(
            Buffer, {"redis": (self.buf, SynchronousExecutor())}, lambda *args: ["redis"]
        )
        orig_times_seen = Group.objects.get(id=default_group.id).times_seen
        delegator.incr(Group, {"times_seen": 5}, {"pk": default_group.id})
        with mock.patch("sentry.buffer.backend", delegator):
            process_incr(batch_keys=[make_key(Group, {"pk": default_group.id})])
        assert Group.objects.get(id=default_group.id).times_seen == orig_times_seen + 5

    def test_get(self) -> None:
        model = mock.Mock()
        model.__name__ = "Mock"
        columns = ["times_seen"]
        filters: dict[str, BufferField] = {"pk": 1}
        # If the value doesn't exist we just assume 0
        assert self.buf.get(model, columns, filters=filters) == {"times_seen": 0}
        self.buf.incr(model, {"times_seen": 1}, filters)
        assert self.buf.get(model, columns, filters=filters) == {"times_seen": 1}
        self.buf.incr(model, {"times_seen": 5}, filters)
        assert self.buf.get(model, columns, filters=filters) == {"times_seen": 6}

    def test_incr_saves_to_redis(self) -> None:
        now = datetime.datetime(2017, 5, 3, 6, 6, 6, tzinfo=datetime.UTC)
        client = self.buf.cluster
        model = mock.Mock()
        model.__name__ = "Mock"
        columns = {"times_seen": 1}
        filters = cast(dict[str, BufferField], {"pk": 1, "datetime": now})
        key = make_key(model, filters=filters)
        self.buf.incr(model, columns, filters, extra={"foo": "bar", "datetime": now})
        result = _hgetall_decode_keys(client, key)

        f = result.pop("f")
        load_values: Callable[[Any], Any]
        load_value: Callable[[Any], Any]
        if self.buf.is_redis_cluster:

            def load_values(x: Any) -> Any:
                return self.buf._load_values(json.loads(x))

            def load_value(x: Any) -> Any:
                return self.buf._load_value(json.loads(x))

        else:
            load_value = load_values = pickle.loads
        assert load_values(f) == {"pk": 1, "datetime": now}
        assert load_value(result.pop("e+datetime")) == now
        assert load_value(result.pop("e+foo")) == "bar"

        assert result == {"i+times_seen": b"1", "m": b"unittest.mock.Mock"}

        pending_key = f"b:p:{crc32(key.encode()) % PENDING_SLICES}"
        pending = client.zrange(pending_key, 0, -1)
        assert pending == [key.encode("utf-8")]
        self.buf.incr(model, columns, filters, extra={"foo": "baz", "datetime": now})
        result = _hgetall_decode_keys(client, key)
        f = result.pop("f")
        assert load_values(f) == {"pk": 1, "datetime": now}
        assert load_value(result.pop("e+datetime")) == now
        assert load_value(result.pop("e+foo")) == "baz"
        assert result == {"i+times_seen": b"2", "m": b"unittest.mock.Mock"}

        pending = client.zrange(pending_key, 0, -1)
        assert pending == [key.encode("utf-8")]

    def test_incr_bounds_pending_key(self) -> None:
        """The pending zset gets an expiry, and that expiry outlives the rows."""
        client = self.buf.cluster
        model = mock.Mock()
        model.__name__ = "Mock"
        filters: dict[str, Any] = {"pk": 1}
        key = make_key(model, filters=filters)

        self.buf.incr(model, {"times_seen": 1}, filters)

        row_ttl = client.ttl(key)
        pending_ttl = client.ttl(f"b:p:{crc32(key.encode()) % PENDING_SLICES}")
        # Both keys are bounded.
        assert 0 < row_ttl <= self.buf.key_expire
        assert 0 < pending_ttl <= self.buf.pending_key_expire
        # The pending zset never dies before a row that it points to.
        assert self.buf.pending_key_expire >= self.buf.key_expire
        assert pending_ttl >= row_ttl

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_process_uses_signal_only(self, process: mock.MagicMock) -> None:
        client = self.buf.cluster

        client.hmset(
            "foo",
            {
                "f": '{"pk": ["i","1"]}',
                "i+times_seen": "1",
                "m": "unittest.mock.Mock",
                "s": "1",
            },
        )
        self.buf.process("foo")
        process.assert_called_once_with(mock.Mock, {"times_seen": 1}, {"pk": 1}, {}, True)

    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_process_keeps_counts_when_pending_zrem_fails(self, process: mock.MagicMock) -> None:
        client = self.buf.cluster
        client.hmset(
            "foo",
            {
                "f": '{"pk": ["i","1"]}',
                "i+times_seen": "1",
                "m": "unittest.mock.Mock",
            },
        )
        # A non-sorted-set value makes ZREM fail, as a dead shard would.
        client.set(f"b:p:{crc32(b'foo') % PENDING_SLICES}", "not-a-zset")

        self.buf.process("foo")

        process.assert_called_once_with(mock.Mock, {"times_seen": 1}, {"pk": 1}, {}, None)

    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_process_flushes_incr_that_lands_during_the_flush(
        self, process: mock.MagicMock
    ) -> None:
        client = self.buf.cluster
        model = mock.Mock()
        model.__name__ = "Mock"
        filters: dict[str, Any] = {"pk": 1}
        key = make_key(model, filters=filters)
        self.buf.incr(model, {"times_seen": 5}, filters)
        real_zrem = client.zrem

        def zrem(*args: Any) -> Any:
            self.buf.incr(model, {"times_seen": 3}, filters)
            return real_zrem(*args)

        with mock.patch.object(client, "zrem", side_effect=zrem):
            self.buf.process(key=key)

        assert process.call_args.args[1] == {"times_seen": 8}
        assert client.hgetall(key) == {}

    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_split_lists_and_clears_row_in_its_slice(self, process: mock.MagicMock) -> None:
        client = self.buf.cluster
        model = mock.Mock()
        model.__name__ = "Mock"
        filters: dict[str, Any] = {"pk": 1}
        key = make_key(model, filters=filters)
        pending_key = f"b:p:{crc32(key.encode()) % PENDING_SLICES}"

        self.buf.incr(model, {"times_seen": 1}, filters)

        assert client.zrange("b:p", 0, -1) == []
        assert len(client.zrange(pending_key, 0, -1)) == 1
        assert 0 < client.ttl(pending_key) <= self.buf.pending_key_expire

        self.buf.process(key=key)

        assert client.zrange(pending_key, 0, -1) == []

    @mock.patch("sentry.buffer.redis.process_incr")
    def test_process_pending_reads_every_slice(self, process_incr: mock.MagicMock) -> None:
        self.buf.incr_batch_size = 5
        client = self.buf.cluster
        client.zadd("b:p", {"foo": 1})
        client.zadd("b:p:63", {"bar": 1})

        self.buf.process_pending()

        assert len(process_incr.apply_async.mock_calls) == 1
        batch_keys = process_incr.apply_async.mock_calls[0].kwargs["kwargs"]["batch_keys"]
        assert sorted(batch_keys) == ["bar", "foo"]
        assert client.zrange("b:p", 0, -1) == []
        assert client.zrange("b:p:63", 0, -1) == []

    @mock.patch("sentry.buffer.redis.random.shuffle")
    @mock.patch("sentry.buffer.redis.process_incr")
    def test_process_pending_flushes_rows_read_before_a_slice_failure(
        self, process_incr: mock.MagicMock, shuffle: mock.MagicMock
    ) -> None:
        self.buf.incr_batch_size = 5
        client = self.buf.cluster
        client.zadd("b:p", {"foo": 1})
        client.zadd("b:p:1", {"bar": 1})
        # With shuffle disabled, b:p is read first and b:p:0 second.
        side_effect = [client.zrange("b:p", 0, -1), RedisConnectionError()]

        with mock.patch.object(client, "zrange", side_effect=side_effect) as zrange:
            self.buf.process_pending()

        assert zrange.call_count == 2
        assert process_incr.apply_async.mock_calls == [
            mock.call(kwargs={"batch_keys": ["foo"]}, headers=mock.ANY)
        ]
        assert client.zrange("b:p:1", 0, -1) != []

    @django_db_all
    @freeze_time()
    def test_incr_uses_signal_only(
        self, default_group: Group, task_runner: Callable[[], AbstractContextManager[None]]
    ) -> None:
        # Make sure group is stored in the cache and keep track of times_seen at the time
        orig_times_seen = Group.objects.get_from_cache(id=default_group.id).times_seen
        times_seen_incr = 5
        self.buf.incr(
            Group,
            {"times_seen": times_seen_incr},
            {"pk": default_group.id},
            {"last_seen": timezone.now()},
            signal_only=True,
        )
        with task_runner(), mock.patch("sentry.buffer.backend", self.buf):
            self.buf.process_pending()
        group = Group.objects.get_from_cache(id=default_group.id)

        # signal_only should not increment the times_seen column
        assert group.times_seen == orig_times_seen


@pytest.mark.parametrize(
    "input",
    [
        (timezone.now(), "datetime"),
        (datetime.date.today(), "date"),
        ("a", "string"),
        (1, "int"),
        (3.14, "float"),
        ({"a": {"i": 0}, "b": {"s": ""}}, "dict"),
        (False, "bool"),
        ([1, "a", 3.14], "list"),
        (
            [
                {
                    "parent_group_id": 4889213441,
                    "should_group": True,
                    "stacktrace_distance": 0.009,
                    "message_distance": 0.0,
                }
            ],
            "list_of_dicts",
        ),
    ],
    ids=lambda input: input[1],
)
def test_dump_and_load_value(input: tuple[Any, str]) -> None:
    value = input[0]
    assert RedisBuffer._load_value(json.loads(json.dumps(RedisBuffer._dump_value(value)))) == value
