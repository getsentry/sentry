import copy
import time
from collections.abc import Generator, Mapping
from typing import Any
from unittest.mock import patch

import pytest
import rb
from redis.exceptions import ConnectionError as RedisConnectionError

from sentry import options
from sentry.buffer.base import BufferField
from sentry.models.project import Project
from sentry.testutils.helpers.redis import use_redis_cluster
from sentry.workflow_engine.buffer.redis_hash_sorted_set_buffer import RedisHashSortedSetBuffer


class MockTimeProvider:
    """Controllable time provider for deterministic tests."""

    def __init__(self, start_time: float = 1000.0):
        self.current_time = start_time

    def __call__(self) -> float:
        return self.current_time

    def advance(self, seconds: float) -> None:
        """Advance time by specified seconds."""
        self.current_time += seconds


@pytest.mark.django_db
class TestRedisHashSortedSetBuffer:
    buf: RedisHashSortedSetBuffer
    mock_time: MockTimeProvider

    @pytest.fixture
    def mock_time_provider(self) -> MockTimeProvider:
        """Provide controllable time for deterministic tests."""
        return MockTimeProvider()

    @pytest.fixture(params=["cluster", "standalone", "blaster"])
    def buffer(
        self, set_sentry_option: Any, request: Any, mock_time_provider: MockTimeProvider
    ) -> Generator[RedisHashSortedSetBuffer]:
        value = copy.deepcopy(options.get("redis.clusters"))
        value["default"]["is_redis_cluster"] = request.param in ["cluster", "standalone"]
        with set_sentry_option("redis.clusters", value):
            match request.param:
                case "cluster":
                    with use_redis_cluster("cluster"):
                        buf = RedisHashSortedSetBuffer(
                            "", {"cluster": "cluster"}, now_fn=mock_time_provider
                        )
                        for _, info in buf.cluster.info("server").items():
                            assert info["redis_mode"] == "cluster"
                        buf.cluster.flushdb()
                        yield buf
                case "standalone":
                    buf = RedisHashSortedSetBuffer(now_fn=mock_time_provider)
                    info = buf.cluster.info("server")
                    assert info["redis_mode"] == "standalone"
                    yield buf
                case "blaster":
                    buf = RedisHashSortedSetBuffer(now_fn=mock_time_provider)
                    assert isinstance(buf.cluster, rb.Cluster)
                    yield buf

    @pytest.fixture(autouse=True)
    def setup_buffer(
        self, buffer: RedisHashSortedSetBuffer, mock_time_provider: MockTimeProvider
    ) -> None:
        self.buf: RedisHashSortedSetBuffer = buffer
        self.mock_time = mock_time_provider

    def test_push_to_hash(self) -> None:
        filters: Mapping[str, BufferField] = {"project_id": 1}

        self.buf.push_to_hash(Project, filters, "test_field", "test_value")
        result = self.buf.get_hash(Project, filters)

        assert result["test_field"] == "test_value"

    def test_push_to_hash_bulk(self) -> None:
        filters: Mapping[str, BufferField] = {"project_id": 1}
        data = {"field1": "value1", "field2": "value2"}

        self.buf.push_to_hash_bulk(Project, filters, data)
        result = self.buf.get_hash(Project, filters)

        assert result["field1"] == "value1"
        assert result["field2"] == "value2"

    def test_get_hash_length(self) -> None:
        """Test getting hash length."""
        filters: Mapping[str, BufferField] = {"project_id": 1}
        data = {"field1": "value1", "field2": "value2", "field3": "value3"}

        self.buf.push_to_hash_bulk(Project, filters, data)
        length = self.buf.get_hash_length(Project, filters)

        assert length == 3

    def test_delete_hash(self) -> None:
        """Test deleting hash fields."""
        filters: Mapping[str, BufferField] = {"project_id": 1}
        data = {"field1": "value1", "field2": "value2", "field3": "value3"}

        self.buf.push_to_hash_bulk(Project, filters, data)
        self.buf.delete_hash(Project, filters, ["field1", "field3"])
        result = self.buf.get_hash(Project, filters)

        assert "field2" in result
        assert "field1" not in result
        assert "field3" not in result

    def test_push_to_sorted_set(self) -> None:
        self.buf.push_to_sorted_set("test_key", 123)

        later = time.time() + 10
        result = self.buf.get_sorted_set("test_key", 0, later)

        assert len(result) == 1
        assert result[0][0] == 123
        assert isinstance(result[0][1], float)  # timestamp

    def test_push_to_sorted_set_bulk(self) -> None:
        values = [123, 456, 789]
        self.buf.push_to_sorted_set("test_key", values)

        later = time.time() + 10
        result = self.buf.get_sorted_set("test_key", 0, later)

        assert len(result) == 3
        result_values = [item[0] for item in result]
        assert set(result_values) == set(values)

    def test_bulk_get_sorted_set(self) -> None:
        keys = [f"test_key_{i}" for i in range(0, 10)]
        for i, key in enumerate(keys):
            self.buf.push_to_sorted_set(key, i)

        later = time.time() + 10
        result = self.buf.bulk_get_sorted_set(keys, 0, later)

        assert len(result) == 10
        for i, key in enumerate(keys):
            assert i in result

    def test_delete_key(self) -> None:
        self.buf.push_to_sorted_set("test_key", [111, 222, 333])

        now = self.mock_time.current_time
        self.buf.delete_key("test_key", 0, now - 1)  # Delete older values

        result = self.buf.get_sorted_set("test_key", 0, now + 10)
        # Should still have values since we deleted older ones
        assert len(result) == 3

    def test_delete_keys_bulk(self) -> None:
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

    def test_conditional_delete_from_sorted_sets_works_with_all_backends(self) -> None:
        """Test that conditional_delete_from_sorted_sets works with all Redis backends."""
        # Should work with all backends (cluster, standalone, and rb.Cluster)
        result = self.buf.conditional_delete_from_sorted_sets(["key1"], [(123, 1.0)])
        assert result == {"key1": []}  # Empty result since key doesn't exist

    def test_conditional_delete_from_sorted_sets_empty_inputs(self) -> None:
        """Test conditional delete with empty inputs."""

        # Empty keys should raise ValueError
        with pytest.raises(ValueError, match="Keys list cannot be empty"):
            self.buf.conditional_delete_from_sorted_sets([], [(123, 1.0)])

        # Empty members_and_scores is fine - no work to do
        result = self.buf.conditional_delete_from_sorted_sets(["key1"], [])
        assert result == {"key1": []}

    def test_conditional_delete_from_sorted_sets_removes_when_score_matches(self) -> None:
        """Test that members are removed when their score is <= provided score."""

        # Add members with controlled timestamps
        key = "test_conditional_key"

        # Add members at first timestamp
        self.buf.push_to_sorted_set(key, [111, 222])

        # Advance time and capture the timestamp
        self.mock_time.advance(10.0)  # Advance by 10 seconds
        later_time = self.mock_time.current_time

        # Add members at later timestamp
        self.buf.push_to_sorted_set(key, [333, 444])

        # Try to delete members with score up to later_time
        # This should remove 111 and 222 (added before later_time)
        # but not 333 and 444 (added after later_time, use older timestamp for them)
        early_time = later_time - 5.0  # Before the later additions
        result = self.buf.conditional_delete_from_sorted_sets(
            [key], [(111, later_time), (222, later_time), (333, early_time), (444, early_time)]
        )

        # Should have removed 111 and 222
        assert set(result[key]) == {111, 222}

        # Verify remaining members
        remaining = self.buf.get_sorted_set(key, 0, time.time() + 10)
        remaining_values = {item[0] for item in remaining}
        assert remaining_values == {333, 444}

    def test_conditional_delete_from_sorted_sets_keeps_newer_members(self) -> None:
        """Test that members with scores > provided score are kept."""

        key = "test_conditional_key2"

        # Add member
        self.buf.push_to_sorted_set(key, 555)

        # Try to delete with an older timestamp (should not delete)
        old_time = self.mock_time.current_time - 10  # 10 seconds ago
        result = self.buf.conditional_delete_from_sorted_sets([key], [(555, old_time)])

        # Should not have removed anything
        assert result[key] == []

        # Verify member is still there
        remaining = self.buf.get_sorted_set(key, 0, time.time() + 10)
        assert len(remaining) == 1
        assert remaining[0][0] == 555

    def test_conditional_delete_from_sorted_sets_multiple_keys(self) -> None:
        """Test conditional delete across multiple keys."""

        keys = ["conditional_key1", "conditional_key2", "conditional_key3"]

        # Add members to all keys
        for key in keys:
            self.buf.push_to_sorted_set(key, [100, 200, 300])

        # Advance time after all adds
        self.mock_time.advance(5.0)
        later = self.mock_time.current_time

        # Delete specific members from all keys
        result = self.buf.conditional_delete_from_sorted_sets(keys, [(100, later), (200, later)])

        # Should have removed 100 and 200 from all keys
        for key in keys:
            assert set(result[key]) == {100, 200}

        # Verify 300 remains in all keys
        for key in keys:
            remaining = self.buf.get_sorted_set(key, 0, time.time() + 10)
            remaining_values = {item[0] for item in remaining}
            assert remaining_values == {300}

    def test_conditional_delete_from_sorted_sets_nonexistent_members(self) -> None:
        """Test conditional delete with members that don't exist."""

        key = "test_conditional_nonexistent"

        # Add only some members
        self.buf.push_to_sorted_set(key, [111])

        # Advance time after adding data
        self.mock_time.advance(5.0)
        later = self.mock_time.current_time

        # Try to delete both existing and non-existing members
        result = self.buf.conditional_delete_from_sorted_sets(
            [key], [(111, later), (999, later)]  # 999 doesn't exist
        )

        # Should only remove the existing member
        assert result[key] == [111]

        # Verify key is now empty
        remaining = self.buf.get_sorted_set(key, 0, time.time() + 10)
        assert len(remaining) == 0

    def test_conditional_delete_from_sorted_sets_rb_fallback(self) -> None:
        """Test that rb.Cluster fallback works atomically using Lua scripts."""
        if self.buf.is_redis_cluster:
            pytest.skip("This test is specifically for rb.Cluster fallback")

        # Add some test data
        key = "rb_fallback_test"
        self.buf.push_to_sorted_set(key, [100, 200])

        # Advance time to get a timestamp after the data was added
        self.mock_time.advance(10.0)
        later = self.mock_time.current_time

        # Test conditional delete using rb.Cluster fallback
        result = self.buf.conditional_delete_from_sorted_sets([key], [(100, later), (200, later)])

        # Should have removed both members using the fallback path
        assert set(result[key]) == {100, 200}

        # Verify key is empty
        remaining = self.buf.get_sorted_set(key, 0, time.time() + 10)
        assert len(remaining) == 0

    def test_conditional_delete_pipelined_performance(self) -> None:
        """Test that multiple key operations are properly pipelined for performance."""
        if not self.buf.is_redis_cluster:
            pytest.skip("Pipelining test is for RedisCluster only")

        # Create many keys with data
        keys = [f"perf_test_key_{i}" for i in range(10)]
        for key in keys:
            self.buf.push_to_sorted_set(key, [100, 200, 300])

        later = time.time() + 1  # Ensure we can delete everything

        # This should execute as a single pipelined operation
        result = self.buf.conditional_delete_from_sorted_sets(
            keys, [(100, later), (200, later), (300, later)]
        )

        # Verify all keys had their members removed
        for key in keys:
            assert set(result[key]) == {100, 200, 300}

        # Verify all keys are empty
        for key in keys:
            remaining = self.buf.get_sorted_set(key, 0, time.time() + 10)
            assert len(remaining) == 0

    def test_conditional_delete_atomicity(self) -> None:
        """Test that conditional delete is atomic - no race conditions between check and delete."""
        key = "atomicity_test"

        # Add a member
        self.buf.push_to_sorted_set(key, [999])

        # Get the current score
        existing = self.buf.get_sorted_set(key, 0, time.time() + 10)
        assert len(existing) == 1
        member, score = existing[0]
        assert member == 999

        # Try to delete with the exact score - should succeed atomically
        result = self.buf.conditional_delete_from_sorted_sets([key], [(999, score)])

        # Should have removed the member
        assert result[key] == [999]

        # Verify key is empty
        remaining = self.buf.get_sorted_set(key, 0, time.time() + 10)
        assert len(remaining) == 0

    def test_conditional_delete_script_loading_failure_propagates(self) -> None:
        """Test that script loading failures are properly propagated."""
        # Only test script loading failure for cluster/standalone since that's where it's called
        if not self.buf.is_redis_cluster:
            pytest.skip("Script loading only happens for RedisCluster")

        # Mock script loading failure
        with patch.object(self.buf, "_ensure_script_loaded_on_cluster") as mock_ensure:
            mock_ensure.side_effect = RedisConnectionError("Connection failed")

            with pytest.raises(RedisConnectionError):
                self.buf.conditional_delete_from_sorted_sets(["key1", "key2"], [(123, 1.0)])

    def test_conditional_delete_slot_based_batching(self) -> None:
        """Test that keys are grouped by slot for efficient batch execution."""
        if not self.buf.is_redis_cluster:
            pytest.skip("Slot-based batching is for RedisCluster only")

        # Test slot calculation
        slot1 = self.buf._calculate_key_slot("test_key_1")
        slot2 = self.buf._calculate_key_slot("test_key_2")
        assert isinstance(slot1, int) and 0 <= slot1 < 16384
        assert isinstance(slot2, int) and 0 <= slot2 < 16384

        # Test key grouping
        keys = ["key1", "key2", "key3", "key4"]
        groups = self.buf._group_keys_by_slot(keys)

        # Verify all keys are assigned to groups
        total_keys = sum(len(group_keys) for group_keys in groups)
        assert total_keys == len(keys)

        # Test with keys that should have same slot (using hash tags)
        same_slot_keys = ["prefix{tag}key1", "prefix{tag}key2", "prefix{tag}key3"]
        same_slot_groups = self.buf._group_keys_by_slot(same_slot_keys)

        # All should be in the same slot due to hash tag
        assert len(same_slot_groups) == 1

    def test_conditional_delete_functional_slot_batching(self) -> None:
        """Test that slot-based batching works functionally with real data."""
        if not self.buf.is_redis_cluster:
            pytest.skip("Slot-based batching is for RedisCluster only")

        # Use hash tags to force keys into same slot for testing
        keys = ["test{slot}key1", "test{slot}key2", "test{slot}key3"]

        # Add data to all keys
        for key in keys:
            self.buf.push_to_sorted_set(key, [100, 200, 300])

        later = time.time() + 1

        # This should execute as a single multi-key script call due to same slot
        result = self.buf.conditional_delete_from_sorted_sets(keys, [(100, later), (200, later)])

        # Verify all keys had the correct members removed
        for key in keys:
            assert set(result[key]) == {100, 200}

        # Verify 300 remains in all keys
        for key in keys:
            remaining = self.buf.get_sorted_set(key, 0, time.time() + 10)
            remaining_values = {item[0] for item in remaining}
            assert remaining_values == {300}

    def test_conditional_delete_multi_slot_pipelining(self) -> None:
        """Test that multiple slot groups are pipelined for optimal performance."""
        if not self.buf.is_redis_cluster:
            pytest.skip("Multi-slot pipelining is for RedisCluster only")

        # Create keys that will likely be in different slots
        keys = [f"slot_test_key_{i}" for i in range(20)]  # High chance of multiple slots

        # Add data to all keys
        for key in keys:
            self.buf.push_to_sorted_set(key, [100, 200])

        later = time.time() + 1

        # This should pipeline multiple slot group executions
        result = self.buf.conditional_delete_from_sorted_sets(keys, [(100, later), (200, later)])

        # Verify all keys had their members removed
        for key in keys:
            assert set(result[key]) == {100, 200}

        # Verify all keys are empty
        for key in keys:
            remaining = self.buf.get_sorted_set(key, 0, time.time() + 10)
            assert len(remaining) == 0

    def test_conditional_delete_rb_host_batching(self) -> None:
        """Test that rb.Cluster groups keys by host for efficient batching."""
        if self.buf.is_redis_cluster:
            pytest.skip("This test is specifically for rb.Cluster host batching")

        # Test with multiple keys that should be batched by host
        keys = [f"rb_host_test_{i}" for i in range(5)]

        # Add data to all keys
        for key in keys:
            self.buf.push_to_sorted_set(key, [100, 200])

        later = time.time() + 1

        # This should group keys by host and execute fewer script calls
        result = self.buf.conditional_delete_from_sorted_sets(keys, [(100, later), (200, later)])

        # Verify all keys had their members removed
        for key in keys:
            assert set(result[key]) == {100, 200}

        # Verify all keys are empty
        for key in keys:
            remaining = self.buf.get_sorted_set(key, 0, time.time() + 10)
            assert len(remaining) == 0

    def test_get_parsed_key_put_parsed_key(self) -> None:
        """Test storing and retrieving pydantic models using get_parsed_key/put_parsed_key."""
        from pydantic import BaseModel

        class TestModel(BaseModel):
            name: str
            value: int
            enabled: bool

        # Test putting and getting a parsed model
        test_data = TestModel(name="test", value=42, enabled=True)
        self.buf.put_parsed_key("test_key", test_data)

        retrieved_data = self.buf.get_parsed_key("test_key", TestModel)

        assert retrieved_data is not None
        assert retrieved_data.name == "test"
        assert retrieved_data.value == 42
        assert retrieved_data.enabled is True
        assert isinstance(retrieved_data, TestModel)

    def test_get_parsed_key_put_parsed_key_complex_model(self) -> None:
        """Test with more complex pydantic model containing nested data."""
        from pydantic import BaseModel

        class NestedModel(BaseModel):
            items: list[int]
            metadata: dict[str, str]

        test_data = NestedModel(
            items=[1, 2, 3, 4, 5], metadata={"source": "test", "version": "1.0"}
        )

        self.buf.put_parsed_key("complex_key", test_data)
        retrieved_data = self.buf.get_parsed_key("complex_key", NestedModel)

        assert retrieved_data is not None
        assert retrieved_data.items == [1, 2, 3, 4, 5]
        assert retrieved_data.metadata == {"source": "test", "version": "1.0"}
        assert isinstance(retrieved_data, NestedModel)

    def test_get_parsed_key_missing_key(self) -> None:
        """Test get_parsed_key returns None for missing key."""
        from pydantic import BaseModel

        class TestModel(BaseModel):
            name: str

        # Try to get a key that doesn't exist
        retrieved_data = self.buf.get_parsed_key("nonexistent_key", TestModel)
        assert retrieved_data is None
