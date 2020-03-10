# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pickle
from sentry.utils.compat import mock

from datetime import datetime
from django.utils import timezone
from sentry.buffer.redis import RedisBuffer, batch_buffers_incr
from sentry.models import Group, Project
from sentry.testutils import TestCase


class RedisBufferTest(TestCase):
    def setUp(self):
        self.buf = RedisBuffer()

    def test_coerce_val_handles_foreignkeys(self):
        assert self.buf._coerce_val(Project(id=1)) == "1"

    def test_coerce_val_handles_unicode(self):
        assert self.buf._coerce_val(u"\u201d") == "”"

    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.redis.process_incr")
    def test_process_pending_one_batch(self, process_incr):
        self.buf.incr_batch_size = 5
        with self.buf.cluster.map() as client:
            client.zadd("b:p", 1, "foo")
            client.zadd("b:p", 2, "bar")
        self.buf.process_pending()
        assert len(process_incr.apply_async.mock_calls) == 1
        process_incr.apply_async.assert_any_call(kwargs={"batch_keys": ["foo", "bar"]})
        client = self.buf.cluster.get_routing_client()
        assert client.zrange("b:p", 0, -1) == []

    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.redis.process_incr")
    def test_process_pending_multiple_batches(self, process_incr):
        self.buf.incr_batch_size = 2
        with self.buf.cluster.map() as client:
            client.zadd("b:p", 1, "foo")
            client.zadd("b:p", 2, "bar")
            client.zadd("b:p", 3, "baz")
        self.buf.process_pending()
        assert len(process_incr.apply_async.mock_calls) == 2
        process_incr.apply_async.assert_any_call(kwargs={"batch_keys": ["foo", "bar"]})
        process_incr.apply_async.assert_any_call(kwargs={"batch_keys": ["baz"]})
        client = self.buf.cluster.get_routing_client()
        assert client.zrange("b:p", 0, -1) == []

    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_process_does_bubble_up_json(self, process):
        client = self.buf.cluster.get_routing_client()
        client.hmset(
            "foo",
            {
                "e+foo": '["s","bar"]',
                "e+datetime": '["d","1493791566.000000"]',
                "f": '{"pk": ["i","1"]}',
                "i+times_seen": "2",
                "m": "sentry.models.Group",
            },
        )
        columns = {"times_seen": 2}
        filters = {"pk": 1}
        extra = {"foo": "bar", "datetime": datetime(2017, 5, 3, 6, 6, 6, tzinfo=timezone.utc)}
        signal_only = None
        self.buf.process("foo")
        process.assert_called_once_with(Group, columns, filters, extra, signal_only)

    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_process_does_bubble_up_pickle(self, process):
        client = self.buf.cluster.get_routing_client()
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

    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.redis.process_incr", mock.Mock())
    def test_incr_saves_to_redis(self):
        now = datetime(2017, 5, 3, 6, 6, 6, tzinfo=timezone.utc)
        client = self.buf.cluster.get_routing_client()
        model = mock.Mock()
        model.__name__ = "Mock"
        columns = {"times_seen": 1}
        filters = {"pk": 1, "datetime": now}
        self.buf.incr(model, columns, filters, extra={"foo": "bar", "datetime": now})
        result = client.hgetall("foo")
        f = result.pop("f")
        assert pickle.loads(f) == {"pk": 1, "datetime": now}
        assert pickle.loads(result.pop("e+datetime")) == now
        assert pickle.loads(result.pop("e+foo")) == "bar"
        assert result == {"i+times_seen": "1", "m": "mock.mock.Mock"}

        pending = client.zrange("b:p", 0, -1)
        assert pending == ["foo"]
        self.buf.incr(model, columns, filters, extra={"foo": "baz", "datetime": now})
        result = client.hgetall("foo")
        f = result.pop("f")
        assert pickle.loads(f) == {"pk": 1, "datetime": now}
        assert pickle.loads(result.pop("e+datetime")) == now
        assert pickle.loads(result.pop("e+foo")) == "baz"
        assert result == {"i+times_seen": "2", "m": "mock.mock.Mock"}

        pending = client.zrange("b:p", 0, -1)
        assert pending == ["foo"]

    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.redis.process_incr", mock.Mock())
    def test_batching_incr_saves_to_redis(self):
        now = datetime(2017, 5, 3, 6, 6, 6, tzinfo=timezone.utc)
        client = self.buf.cluster.get_routing_client()
        model = mock.Mock()
        model.__name__ = "Mock"
        columns = {"times_seen": 1}
        filters = {"pk": 1, "datetime": now}
        with mock.patch("sentry.app.buffer", self.buf):
            with batch_buffers_incr():
                self.buf.incr(model, columns, filters, extra={"foo": "bar", "datetime": now})

                # changes should only be visible on batching_buffers_incr() exit
                assert not client.hgetall("foo")

                self.buf.incr(model, columns, filters, extra={"foo": "baz", "datetime": now})

        result = client.hgetall("foo")
        f = result.pop("f")
        assert pickle.loads(f) == {"pk": 1, "datetime": now}
        assert pickle.loads(result.pop("e+datetime")) == now
        assert pickle.loads(result.pop("e+foo")) == "baz"
        assert result == {"i+times_seen": "2", "m": "mock.mock.Mock"}

        pending = client.zrange("b:p", 0, -1)
        assert pending == ["foo"]

    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.redis.process_incr")
    @mock.patch("sentry.buffer.redis.process_pending")
    def test_process_pending_partitions_none(self, process_pending, process_incr):
        self.buf.pending_partitions = 2
        with self.buf.cluster.map() as client:
            client.zadd("b:p:0", 1, "foo")
            client.zadd("b:p:1", 1, "bar")
            client.zadd("b:p", 1, "baz")

        # On first pass, we are expecting to do:
        # * process the buffer that doesn't have a partition (b:p)
        # * queue up 2 jobs, one for each partition to process.
        self.buf.process_pending()
        assert len(process_incr.apply_async.mock_calls) == 1
        process_incr.apply_async.assert_any_call(kwargs={"batch_keys": ["baz"]})
        assert len(process_pending.apply_async.mock_calls) == 2
        process_pending.apply_async.mock_calls == [
            mock.call(kwargs={"partition": 0}),
            mock.call(kwargs={"partition": 1}),
        ]

        # Confirm that we've only processed the unpartitioned buffer
        client = self.buf.cluster.get_routing_client()
        assert client.zrange("b:p", 0, -1) == []
        assert client.zrange("b:p:0", 0, -1) != []
        assert client.zrange("b:p:1", 0, -1) != []

        # partition 0
        self.buf.process_pending(partition=0)
        assert len(process_incr.apply_async.mock_calls) == 2
        process_incr.apply_async.assert_any_call(kwargs={"batch_keys": ["foo"]})
        assert client.zrange("b:p:0", 0, -1) == []

        # Make sure we didn't queue up more
        assert len(process_pending.apply_async.mock_calls) == 2

        # partition 1
        self.buf.process_pending(partition=1)
        assert len(process_incr.apply_async.mock_calls) == 3
        process_incr.apply_async.assert_any_call(kwargs={"batch_keys": ["bar"]})
        assert client.zrange("b:p:1", 0, -1) == []

        # Make sure we didn't queue up more
        assert len(process_pending.apply_async.mock_calls) == 2

    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_process_uses_signal_only(self, process):
        client = self.buf.cluster.get_routing_client()
        client.hmset(
            "foo",
            {
                "f": '{"pk": ["i","1"]}',
                "i+times_seen": "1",
                "m": "sentry.utils.compat.mock.Mock",
                "s": "1",
            },
        )
        self.buf.process("foo")
        process.assert_called_once_with(mock.Mock, {"times_seen": 1}, {"pk": 1}, {}, True)

    """
    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key", mock.Mock(return_value="foo"))
    def test_incr_uses_signal_only(self):
        now = datetime(2017, 5, 3, 6, 6, 6, tzinfo=timezone.utc)
        client = self.buf.cluster.get_routing_client()
        model = mock.Mock()
        model.__name__ = "Mock"
        columns = {"times_seen": 1}
        filters = {"pk": 1, "datetime": now}
        self.buf.incr(model, columns, filters, extra={"foo": "bar", "datetime": now}, signal_only=True)
        result = client.hgetall("foo")
        assert result == {
            "e+foo": '["s","bar"]',
            "e+datetime": '["d","1493791566.000000"]',
            "f": '{"pk":["i","1"],"datetime":["d","1493791566.000000"]}',
            "i+times_seen": "1",
            "m": "mock.mock.Mock",
            "s": "1"
        }
    """

    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.redis._local_buffers", dict())
    def test_signal_only_saved_local_buffs(self):
        now = datetime(2017, 5, 3, 6, 6, 6, tzinfo=timezone.utc)
        model = mock.Mock()
        model.__name__ = "Mock"
        columns = {"times_seen": 1}
        filters = {"pk": 1, "datetime": now}

        self.buf.incr(
            model, columns, filters, extra={"foo": "bar", "datetime": now}, signal_only=True
        )

        from sentry.buffer.redis import _local_buffers

        frozen_filters = tuple(sorted(filters.items()))
        key = (frozen_filters, model)
        values = _local_buffers[key]

        assert values[-1]  # signal_only stored last
