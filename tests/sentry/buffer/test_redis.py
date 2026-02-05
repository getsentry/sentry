import copy
import datetime
import pickle
import random
from collections import defaultdict
from collections.abc import Mapping
from unittest import mock

import pytest
from django.utils import timezone

from sentry import options
from sentry.buffer.redis import RedisBuffer, _coerce_val, make_key
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.rules.processing.processor import PROJECT_ID_BUFFER_LIST_KEY
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
        key = make_key(model, filters=filters)
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
        project_ids_to_rule_data: defaultdict[int, list[dict[str, str]]] = defaultdict(list)
        for proj_id in project_ids:
            rule_group_pairs = buffer.get_hash(Project, {"project_id": proj_id[0]})
            for k, v in rule_group_pairs.items():
                project_ids_to_rule_data[int(proj_id[0])].append({k: v})
        return project_ids_to_rule_data

    def test_enqueue(self) -> None:
        project_id = 1
        rule_id = 2
        group_id = 3
        event_id = 4
        group2_id = 5
        event2_id = 6

        project_id2 = 7
        rule2_id = 8
        group3_id = 9
        event3_id = 10
        event4_id = 11

        # store the project ids
        self.buf.push_to_sorted_set(key=PROJECT_ID_BUFFER_LIST_KEY, value=[project_id, project_id2])

        # store the rules and group per project
        self.buf.push_to_hash(
            model=Project,
            filters={"project_id": project_id},
            field=f"{rule_id}:{group_id}",
            value=json.dumps({"event_id": event_id, "occurrence_id": None}),
        )
        self.buf.push_to_hash(
            model=Project,
            filters={"project_id": project_id},
            field=f"{rule_id}:{group2_id}",
            value=json.dumps({"event_id": event2_id, "occurrence_id": None}),
        )
        self.buf.push_to_hash(
            model=Project,
            filters={"project_id": project_id2},
            field=f"{rule2_id}:{group3_id}",
            value=json.dumps({"event_id": event3_id, "occurrence_id": None}),
        )
        project_ids = self.buf.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.datetime.now().timestamp()
        )
        assert project_ids
        project_ids_to_rule_data = self.group_rule_data_by_project_id(self.buf, project_ids)
        result = json.loads(project_ids_to_rule_data[project_id][0].get(f"{rule_id}:{group_id}"))
        assert result.get("event_id") == event_id
        result = json.loads(project_ids_to_rule_data[project_id][1].get(f"{rule_id}:{group2_id}"))
        assert result.get("event_id") == event2_id
        result = json.loads(project_ids_to_rule_data[project_id2][0].get(f"{rule2_id}:{group3_id}"))
        assert result.get("event_id") == event3_id

        # overwrite the value to event4_id
        self.buf.push_to_hash(
            model=Project,
            filters={"project_id": project_id2},
            field=f"{rule2_id}:{group3_id}",
            value=json.dumps({"event_id": event4_id, "occurrence_id": None}),
        )

        project_ids_to_rule_data = project_ids_to_rule_data = self.group_rule_data_by_project_id(
            self.buf, project_ids
        )
        result = json.loads(project_ids_to_rule_data[project_id2][0].get(f"{rule2_id}:{group3_id}"))
        assert result.get("event_id") == event4_id

    def test_get_bulk_sorted_set(self) -> None:
        shards = 3
        project_ids = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4]
        for id in project_ids:
            shard = random.randrange(shards)
            if shard == 0:
                key = PROJECT_ID_BUFFER_LIST_KEY
            else:
                key = f"{PROJECT_ID_BUFFER_LIST_KEY}:{shard}"
            self.buf.push_to_sorted_set(key=key, value=id)

        buffer_keys = [
            f"{PROJECT_ID_BUFFER_LIST_KEY}:{shard}" if shard > 0 else PROJECT_ID_BUFFER_LIST_KEY
            for shard in range(shards)
        ]

        project_ids_and_timestamps = self.buf.bulk_get_sorted_set(
            buffer_keys,
            min=0,
            max=datetime.datetime.now().timestamp(),
        )
        assert len(project_ids_and_timestamps) == 4
        assert set(project_ids_and_timestamps.keys()) == set(project_ids)

        self.buf.delete_keys(
            buffer_keys,
            min=0,
            max=datetime.datetime.now().timestamp(),
        )
        project_ids_and_timestamps = self.buf.bulk_get_sorted_set(
            buffer_keys,
            min=0,
            max=datetime.datetime.now().timestamp(),
        )
        assert len(project_ids_and_timestamps) == 0

    def test_bulk_sorted_set_single_key(self) -> None:
        project_ids = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4]
        for id in project_ids:
            self.buf.push_to_sorted_set(key=PROJECT_ID_BUFFER_LIST_KEY, value=id)
        project_ids_and_timestamps = self.buf.bulk_get_sorted_set(
            [PROJECT_ID_BUFFER_LIST_KEY],
            min=0,
            max=datetime.datetime.now().timestamp(),
        )
        assert len(project_ids_and_timestamps) == 4
        assert set(project_ids_and_timestamps.keys()) == set(project_ids)

    def test_delete_batch(self) -> None:
        """Test that after we add things to redis we can clean it up"""
        project_id = 1
        rule_id = 2
        group_id = 3
        event_id = 4

        project2_id = 5
        rule2_id = 6
        group2_id = 7
        event2_id = 8

        now = datetime.datetime(2024, 4, 15, 3, 30, 00, tzinfo=datetime.UTC)
        one_minute_from_now = (now).replace(minute=31)

        # add a set and a hash to the buffer
        with freeze_time(now):
            self.buf.push_to_sorted_set(key=PROJECT_ID_BUFFER_LIST_KEY, value=project_id)
            self.buf.push_to_hash(
                model=Project,
                filters={"project_id": project_id},
                field=f"{rule_id}:{group_id}",
                value=json.dumps({"event_id": event_id, "occurrence_id": None}),
            )
        with freeze_time(one_minute_from_now):
            self.buf.push_to_sorted_set(key=PROJECT_ID_BUFFER_LIST_KEY, value=project2_id)
            self.buf.push_to_hash(
                model=Project,
                filters={"project_id": project2_id},
                field=f"{rule2_id}:{group2_id}",
                value=json.dumps({"event_id": event2_id, "occurrence_id": None}),
            )

        # retrieve them
        project_ids = self.buf.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.datetime.now().timestamp()
        )
        assert len(project_ids) == 2
        rule_group_pairs = self.buf.get_hash(Project, {"project_id": project_id})
        assert len(rule_group_pairs)

        # delete only the first project ID by time
        self.buf.delete_key(PROJECT_ID_BUFFER_LIST_KEY, min=0, max=now.timestamp())

        # retrieve again to make sure only project_id was removed
        project_ids = self.buf.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.datetime.now().timestamp()
        )
        assert project_ids == [(project2_id, one_minute_from_now.timestamp())]

        # delete the project_id hash
        self.buf.delete_hash(
            model=Project,
            filters={"project_id": project_id},
            fields=[f"{rule_id}:{group_id}"],
        )

        rule_group_pairs = self.buf.get_hash(Project, {"project_id": project_id})
        assert rule_group_pairs == {}

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

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    def test_get_hash_length(self) -> None:
        client = get_cluster_routing_client(self.buf.cluster, self.buf.is_redis_cluster)
        data: Mapping[str | bytes, bytes | float | int | str] = {
            "f": '{"pk": ["i","1"]}',
            "i+times_seen": "1",
            "m": "unittest.mock.Mock",
            "s": "1",
        }

        client.hmset("foo", data)
        buffer_length = self.buf.get_hash_length("foo", field={"bar": 1})
        assert buffer_length == len(data)

    @mock.patch("sentry.buffer.redis.make_key", mock.Mock(return_value="foo"))
    def test_push_to_hash_bulk(self) -> None:
        def decode_dict(d):
            return {k: v.decode("utf-8") if isinstance(v, bytes) else v for k, v in d.items()}

        client = get_cluster_routing_client(self.buf.cluster, self.buf.is_redis_cluster)
        data = {
            "f": '{"pk": ["i","1"]}',
            "i+times_seen": "1",
            "m": "unittest.mock.Mock",
            "s": "1",
        }
        self.buf.push_to_hash_bulk(model=Project, filters={"project_id": 1}, data=data)
        result = _hgetall_decode_keys(client, "foo", self.buf.is_redis_cluster)
        assert decode_dict(result) == data

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
