import copy
import datetime
import pickle
from collections import defaultdict
from unittest import mock

import pytest
from django.utils import timezone

from sentry import options
from sentry.buffer.redis import RedisBuffer, _coerce_val, _get_model_key, redis_buffer_router
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json
from sentry.utils.redis import get_cluster_routing_client


def _hgetall_decode_keys(client, key, is_redis_cluster):
    ret = client.hgetall(key)
    if not is_redis_cluster:
        return {k.decode(): v for k, v in ret.items()}
    else:
        return ret


@pytest.mark.django_db
class TestRedisBuffer:
    @pytest.fixture(params=["cluster", "blaster"])
    def buffer(self, set_sentry_option, request):
        value = copy.deepcopy(options.get("redis.clusters"))
        value["default"]["is_redis_cluster"] = request.param == "cluster"
        with set_sentry_option("redis.clusters", value):
            yield RedisBuffer()

    @pytest.fixture(autouse=True)
    def setup_buffer(self, buffer):
        self.buf = buffer

    def test_coerce_val_handles_foreignkeys(self) -> None:
        assert _coerce_val(Project(id=1)) == b"1"

    def test_coerce_val_handles_unicode(self) -> None:
        assert _coerce_val("\u201d") == "\u201d".encode()

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.redis.process_incr")
    def test_process_pending_one_batch(self, process_incr) -> None:
        self.buf.incr_batch_size = 5
        client = get_cluster_routing_client(self.buf.cluster, self.buf.is_redis_cluster)
        client.zadd("b:p", {"foo": 1, "bar": 2})
        self.buf.process_pending()
        assert len(process_incr.apply_async.mock_calls) == 1
        assert process_incr.apply_async.mock_calls == [
            mock.call(kwargs={"batch_keys": ["foo", "bar"]}, headers=mock.ANY)
        ]
        client = get_cluster_routing_client(self.buf.cluster, self.buf.is_redis_cluster)
        assert client.zrange("b:p", 0, -1) == []

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.redis.process_incr")
    def test_process_pending_multiple_batches(self, process_incr) -> None:
        self.buf.incr_batch_size = 2
        client = get_cluster_routing_client(self.buf.cluster, self.buf.is_redis_cluster)
        client.zadd("b:p", {"foo": 1, "bar": 2, "baz": 3})
        self.buf.process_pending()
        assert len(process_incr.apply_async.mock_calls) == 2
        process_incr.apply_async.assert_any_call(
            kwargs={"batch_keys": ["foo", "bar"]}, headers=mock.ANY
        )
        process_incr.apply_async.assert_any_call(kwargs={"batch_keys": ["baz"]}, headers=mock.ANY)
        client = get_cluster_routing_client(self.buf.cluster, self.buf.is_redis_cluster)
        assert client.zrange("b:p", 0, -1) == []

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_process_does_bubble_up_json(self, process) -> None:
        client = get_cluster_routing_client(self.buf.cluster, self.buf.is_redis_cluster)

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
    def test_process_does_bubble_up_pickle(self, process) -> None:
        client = get_cluster_routing_client(self.buf.cluster, self.buf.is_redis_cluster)

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
    def test_group_cache_updated(self, default_group, task_runner) -> None:
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

    def test_get(self) -> None:
        model = mock.Mock()
        model.__name__ = "Mock"
        columns = ["times_seen"]
        filters = {"pk": 1}
        # If the value doesn't exist we just assume 0
        assert self.buf.get(model, columns, filters=filters) == {"times_seen": 0}
        self.buf.incr(model, {"times_seen": 1}, filters)
        assert self.buf.get(model, columns, filters=filters) == {"times_seen": 1}
        self.buf.incr(model, {"times_seen": 5}, filters)
        assert self.buf.get(model, columns, filters=filters) == {"times_seen": 6}

    def test_incr_saves_to_redis(self) -> None:
        now = datetime.datetime(2017, 5, 3, 6, 6, 6, tzinfo=datetime.UTC)
        client = get_cluster_routing_client(self.buf.cluster, self.buf.is_redis_cluster)
        model = mock.Mock()
        model.__name__ = "Mock"
        columns = {"times_seen": 1}
        filters = {"pk": 1, "datetime": now}
        key = self.buf._make_key(model, filters=filters)
        self.buf.incr(model, columns, filters, extra={"foo": "bar", "datetime": now})
        result = _hgetall_decode_keys(client, key, self.buf.is_redis_cluster)

        f = result.pop("f")
        if self.buf.is_redis_cluster:

            def load_values(x):
                return self.buf._load_values(json.loads(x))

            def load_value(x):
                return self.buf._load_value(json.loads(x))

        else:
            load_value = load_values = pickle.loads
        assert load_values(f) == {"pk": 1, "datetime": now}
        assert load_value(result.pop("e+datetime")) == now
        assert load_value(result.pop("e+foo")) == "bar"

        if self.buf.is_redis_cluster:
            assert result == {"i+times_seen": "1", "m": "unittest.mock.Mock"}
        else:
            assert result == {"i+times_seen": b"1", "m": b"unittest.mock.Mock"}

        pending = client.zrange("b:p", 0, -1)
        if self.buf.is_redis_cluster:
            assert pending == [key]
        else:
            assert pending == [key.encode("utf-8")]
        self.buf.incr(model, columns, filters, extra={"foo": "baz", "datetime": now})
        result = _hgetall_decode_keys(client, key, self.buf.is_redis_cluster)
        f = result.pop("f")
        assert load_values(f) == {"pk": 1, "datetime": now}
        assert load_value(result.pop("e+datetime")) == now
        assert load_value(result.pop("e+foo")) == "baz"
        if self.buf.is_redis_cluster:
            assert result == {"i+times_seen": "2", "m": "unittest.mock.Mock"}
        else:
            assert result == {"i+times_seen": b"2", "m": b"unittest.mock.Mock"}

        pending = client.zrange("b:p", 0, -1)
        if self.buf.is_redis_cluster:
            assert pending == [key]
        else:
            assert pending == [key.encode("utf-8")]

    def group_rule_data_by_project_id(self, buffer, project_ids):
        project_ids_to_rule_data = defaultdict(list)
        for proj_id in project_ids:
            rule_group_pairs = buffer.get_hash(Project, {"project_id": proj_id[0]})
            for k, v in rule_group_pairs.items():
                project_ids_to_rule_data[int(proj_id[0])].append({k: v})
        return project_ids_to_rule_data

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    @mock.patch("sentry.buffer.base.Buffer.process")
    def test_process_uses_signal_only(self, process) -> None:
        client = get_cluster_routing_client(self.buf.cluster, self.buf.is_redis_cluster)

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

    @django_db_all
    @freeze_time()
    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key")
    @mock.patch("sentry.buffer.redis.process_incr")
    def test_assign_custom_queue(
        self,
        mock_process_incr: mock.MagicMock,
        mock_make_key: mock.MagicMock,
        default_group,
        task_runner,
    ):
        original_routers = redis_buffer_router._routers
        redis_buffer_router._routers = dict()

        mock_make_key.return_value = f"b:k:{_get_model_key(model=Group)}:md5"

        num_of_calls = 0

        def generate_group_queue(model_key: str) -> str | None:
            nonlocal num_of_calls
            num_of_calls += 1
            assert model_key == "sentry.group"
            return "group-counters-0"

        redis_buffer_router.assign_queue(model=Group, generate_queue=generate_group_queue)

        times_seen_incr = 5

        mock_make_key.return_value = f"b:k:{_get_model_key(model=Group)}:md5"
        self.buf.incr(
            Group,
            {"times_seen": times_seen_incr},
            {"pk": default_group.id},
            {"last_seen": timezone.now()},
        )

        # Project model is not assigned to a dedicated queue
        mock_make_key.return_value = f"b:k:{_get_model_key(model=Project)}:md5"
        self.buf.incr(
            Project,
            {"times_seen": times_seen_incr},
            {"pk": default_group.id},
            {"last_seen": timezone.now()},
        )
        with task_runner(), mock.patch("sentry.buffer.backend", self.buf):
            self.buf.process_pending()

        assert len(mock_process_incr.apply_async.mock_calls) == 2
        assert mock_process_incr.apply_async.mock_calls == [
            mock.call(
                kwargs={"batch_keys": ["b:k:sentry.group:md5"]},
                headers={"sentry-propagate-traces": False},
                queue="group-counters-0",
            ),
            mock.call(
                kwargs={"batch_keys": ["b:k:sentry.project:md5"]},
                headers={"sentry-propagate-traces": False},
            ),
        ]

        redis_buffer_router._routers = original_routers
        assert num_of_calls == 1

    @django_db_all
    @freeze_time()
    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key")
    @mock.patch("sentry.buffer.redis.process_incr")
    def test_assign_custom_queue_multiple_batches(
        self,
        mock_process_incr: mock.MagicMock,
        mock_make_key: mock.MagicMock,
        default_group,
        task_runner,
    ):
        self.buf.incr_batch_size = 2

        original_routers = redis_buffer_router._routers
        redis_buffer_router._routers = dict()

        num_of_calls = 0

        def generate_group_queue(model_key: str) -> str | None:
            nonlocal num_of_calls
            num_of_calls += 1
            assert model_key == "sentry.group"
            return "group-counters-0"

        redis_buffer_router.assign_queue(model=Group, generate_queue=generate_group_queue)

        times_seen_incr = 5

        mock_make_key.return_value = f"b:k:{_get_model_key(model=Group)}:md5-1"
        self.buf.incr(
            Group,
            {"times_seen": times_seen_incr},
            {"pk": default_group.id},
            {"last_seen": timezone.now()},
        )

        # Project model is not assigned to a dedicated queue
        mock_make_key.return_value = f"b:k:{_get_model_key(model=Project)}:md5-2"
        self.buf.incr(
            Project,
            {"times_seen": times_seen_incr},
            {"pk": default_group.id + 1},
            {"last_seen": timezone.now()},
        )

        mock_make_key.return_value = f"b:k:{_get_model_key(model=Group)}:md5-3"
        self.buf.incr(
            Group,
            {"times_seen": times_seen_incr},
            {"pk": default_group.id + 2},
            {"last_seen": timezone.now()},
        )
        with task_runner(), mock.patch("sentry.buffer.backend", self.buf):
            self.buf.process_pending()

        assert len(mock_process_incr.apply_async.mock_calls) == 2
        assert mock_process_incr.apply_async.mock_calls == [
            # Only the Group model keys are batched together for the assigned dedicated queue
            mock.call(
                kwargs={"batch_keys": ["b:k:sentry.group:md5-1", "b:k:sentry.group:md5-3"]},
                headers={"sentry-propagate-traces": False},
                queue="group-counters-0",
            ),
            mock.call(
                kwargs={"batch_keys": ["b:k:sentry.project:md5-2"]},
                headers={"sentry-propagate-traces": False},
            ),
        ]

        redis_buffer_router._routers = original_routers
        assert num_of_calls == 1

    @django_db_all
    @freeze_time()
    @mock.patch("sentry.buffer.redis.RedisBuffer._make_key")
    @mock.patch("sentry.buffer.redis.process_incr")
    def test_custom_queue_function_fallback(
        self,
        mock_process_incr: mock.MagicMock,
        mock_make_key: mock.MagicMock,
        default_group,
        task_runner,
    ):
        original_routers = redis_buffer_router._routers
        redis_buffer_router._routers = dict()

        mock_make_key.return_value = f"b:k:{_get_model_key(model=Group)}:md5"

        num_of_calls = 0

        def generate_group_queue(model_key: str) -> str | None:
            nonlocal num_of_calls
            num_of_calls += 1
            assert model_key == "sentry.group"
            # Return None to fallback to the default queue
            return None

        redis_buffer_router.assign_queue(model=Group, generate_queue=generate_group_queue)

        times_seen_incr = 5

        mock_make_key.return_value = f"b:k:{_get_model_key(model=Group)}:md5"
        self.buf.incr(
            Group,
            {"times_seen": times_seen_incr},
            {"pk": default_group.id},
            {"last_seen": timezone.now()},
        )

        # Project model is not assigned to a dedicated queue
        mock_make_key.return_value = f"b:k:{_get_model_key(model=Project)}:md5"
        self.buf.incr(
            Project,
            {"times_seen": times_seen_incr},
            {"pk": default_group.id},
            {"last_seen": timezone.now()},
        )
        with task_runner(), mock.patch("sentry.buffer.backend", self.buf):
            self.buf.process_pending()

        assert len(mock_process_incr.apply_async.mock_calls) == 2
        assert mock_process_incr.apply_async.mock_calls == [
            mock.call(
                kwargs={"batch_keys": ["b:k:sentry.group:md5"]},
                headers={"sentry-propagate-traces": False},
            ),
            mock.call(
                kwargs={"batch_keys": ["b:k:sentry.project:md5"]},
                headers={"sentry-propagate-traces": False},
            ),
        ]

        redis_buffer_router._routers = original_routers
        assert num_of_calls == 1

    @django_db_all
    @freeze_time()
    def test_incr_uses_signal_only(self, default_group, task_runner) -> None:
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
    "value",
    [
        timezone.now(),
        datetime.date.today(),
    ],
)
def test_dump_value(value: datetime.datetime) -> None:
    assert RedisBuffer._load_value(json.loads(json.dumps(RedisBuffer._dump_value(value)))) == value
