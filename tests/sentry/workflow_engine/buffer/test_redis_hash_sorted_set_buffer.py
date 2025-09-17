import copy
import time
from collections.abc import Mapping

import pytest
import rb

from sentry import options
from sentry.buffer.base import BufferField
from sentry.models.project import Project
from sentry.testutils.helpers.redis import use_redis_cluster
from sentry.workflow_engine.buffer.redis_hash_sorted_set_buffer import RedisHashSortedSetBuffer


@pytest.mark.django_db
class TestRedisHashSortedSetBuffer:
    @pytest.fixture(params=["cluster", "standalone", "blaster"])
    def buffer(self, set_sentry_option, request):
        value = copy.deepcopy(options.get("redis.clusters"))
        value["default"]["is_redis_cluster"] = request.param in ["cluster", "standalone"]
        with set_sentry_option("redis.clusters", value):
            match request.param:
                case "cluster":
                    with use_redis_cluster("cluster"):
                        buf = RedisHashSortedSetBuffer("", {"cluster": "cluster"})
                        for _, info in buf.cluster.info("server").items():
                            assert info["redis_mode"] == "cluster"
                        buf.cluster.flushdb()
                        yield buf
                case "standalone":
                    buf = RedisHashSortedSetBuffer()
                    info = buf.cluster.info("server")
                    assert info["redis_mode"] == "standalone"
                    yield buf
                case "blaster":
                    buf = RedisHashSortedSetBuffer()
                    assert isinstance(buf.cluster, rb.Cluster)
                    yield buf

    @pytest.fixture(autouse=True)
    def setup_buffer(self, buffer):
        self.buf: RedisHashSortedSetBuffer = buffer

    def test_push_to_hash(self):
        filters: Mapping[str, BufferField] = {"project_id": 1}

        self.buf.push_to_hash(Project, filters, "test_field", "test_value")
        result = self.buf.get_hash(Project, filters)

        assert result["test_field"] == "test_value"

    def test_push_to_hash_bulk(self):
        filters: Mapping[str, BufferField] = {"project_id": 1}
        data = {"field1": "value1", "field2": "value2"}

        self.buf.push_to_hash_bulk(Project, filters, data)
        result = self.buf.get_hash(Project, filters)

        assert result["field1"] == "value1"
        assert result["field2"] == "value2"

    def test_get_hash_length(self):
        """Test getting hash length."""
        filters: Mapping[str, BufferField] = {"project_id": 1}
        data = {"field1": "value1", "field2": "value2", "field3": "value3"}

        self.buf.push_to_hash_bulk(Project, filters, data)
        length = self.buf.get_hash_length(Project, filters)

        assert length == 3

    def test_delete_hash(self):
        """Test deleting hash fields."""
        filters: Mapping[str, BufferField] = {"project_id": 1}
        data = {"field1": "value1", "field2": "value2", "field3": "value3"}

        self.buf.push_to_hash_bulk(Project, filters, data)
        self.buf.delete_hash(Project, filters, ["field1", "field3"])
        result = self.buf.get_hash(Project, filters)

        assert "field2" in result
        assert "field1" not in result
        assert "field3" not in result

    def test_push_to_sorted_set(self):
        self.buf.push_to_sorted_set("test_key", 123)

        later = time.time() + 10
        result = self.buf.get_sorted_set("test_key", 0, later)

        assert len(result) == 1
        assert result[0][0] == 123
        assert isinstance(result[0][1], float)  # timestamp

    def test_push_to_sorted_set_bulk(self):
        values = [123, 456, 789]
        self.buf.push_to_sorted_set("test_key", values)

        later = time.time() + 10
        result = self.buf.get_sorted_set("test_key", 0, later)

        assert len(result) == 3
        result_values = [item[0] for item in result]
        assert set(result_values) == set(values)

    def test_bulk_get_sorted_set(self):
        keys = [f"test_key_{i}" for i in range(0, 10)]
        for i, key in enumerate(keys):
            self.buf.push_to_sorted_set(key, i)

        later = time.time() + 10
        result = self.buf.bulk_get_sorted_set(keys, 0, later)

        assert len(result) == 10
        for i, key in enumerate(keys):
            assert i in result

    def test_delete_key(self):
        self.buf.push_to_sorted_set("test_key", [111, 222, 333])

        now = time.time()
        self.buf.delete_key("test_key", 0, now - 1)  # Delete older values

        result = self.buf.get_sorted_set("test_key", 0, now + 10)
        # Should still have values since we deleted older ones
        assert len(result) == 3

    def test_delete_keys_bulk(self):
        keys = [f"test_key_{i}" for i in range(0, 10)]
        for i, key in enumerate(keys):
            self.buf.push_to_sorted_set(key, i)

        later = time.time() + 10
        self.buf.delete_keys(keys, 0, later)

        # Should have no values left
        result1 = self.buf.get_sorted_set(keys[0], 0, later)
        result2 = self.buf.get_sorted_set(keys[9], 0, later)
        assert len(result1) == 0
        assert len(result2) == 0
