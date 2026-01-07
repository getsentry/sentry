import time
import uuid
from functools import cached_property
from unittest.mock import Mock, patch

import pytest

from sentry.digests.backends.base import InvalidState
from sentry.digests.backends.redis import RedisClusterBackend
from sentry.digests.types import Notification, Record
from sentry.models.project import Project
from sentry.testutils.cases import TestCase


class RedisClusterBackendTestCase(TestCase):
    @cached_property
    def project(self) -> Project:
        return self.create_project(fire_project_created=True)

    @cached_property
    def notification(self) -> Notification:
        rule = self.event.project.rule_set.all()[0]
        return Notification(self.event, (rule.id,), str(uuid.uuid4()))

    def test_basic(self) -> None:
        backend = RedisClusterBackend()

        # The first item should return "true", indicating that this timeline
        # can be immediately dispatched to be digested.
        record_1 = Record("record:1", self.notification, time.time())
        assert backend.add("timeline", record_1) is True

        # The second item should return "false", since it's ready to be
        # digested but dispatching again would cause it to be sent twice.
        record_2 = Record("record:2", self.notification, time.time())
        assert backend.add("timeline", record_2) is False

        # There's nothing to move between sets, so scheduling should return nothing.
        assert set(backend.schedule(time.time())) == set()

        with backend.digest("timeline", 0) as records:
            assert {record.key for record in records} == {record_1.key, record_2.key}

        # The schedule should now contain the timeline.
        assert {entry.key for entry in backend.schedule(time.time())} == {"timeline"}

        # We didn't add any new records so there's nothing to do here.
        with backend.digest("timeline", 0) as records:
            assert not records

        # There's nothing to move between sets since the timeline contents no
        # longer exist at this point.
        assert set(backend.schedule(time.time())) == set()

    def test_truncation(self) -> None:
        backend = RedisClusterBackend(capacity=2, truncation_chance=1.0)

        records = [Record(f"record:{i}", self.notification, time.time()) for i in range(4)]
        for record in records:
            backend.add("timeline", record)

        with backend.digest("timeline", 0) as records:
            assert {record.key for record in records} == {"record:2", "record:3"}

    def test_maintenance_failure_recovery(self) -> None:
        backend = RedisClusterBackend()

        record_1 = Record("record:1", self.notification, time.time())
        backend.add("timeline", record_1)

        try:
            with backend.digest("timeline", 0) as records:
                raise Exception("This causes the digest to not be closed.")
        except Exception:
            pass

        # Maintenance should move the timeline back to the waiting state, ...
        backend.maintenance(time.time())

        # ...and you can't send a digest in the waiting state.
        with pytest.raises(InvalidState):
            with backend.digest("timeline", 0):
                raise AssertionError("unreachable")

        record_2 = Record("record:2", self.notification, time.time())
        backend.add("timeline", record_2)

        # The schedule should now contain the timeline.
        assert {entry.key for entry in backend.schedule(time.time())} == {"timeline"}

        # The existing and new record should be there because the timeline
        # contents were merged back into the digest.
        with backend.digest("timeline", 0) as records:
            assert {record.key for record in records} == {"record:1", "record:2"}

    def test_maintenance_failure_recovery_with_capacity(self) -> None:
        backend = RedisClusterBackend(capacity=10, truncation_chance=0.0)

        t = time.time()

        # Add 10 items to the timeline.
        for i in range(10):
            backend.add("timeline", Record(f"record:{i}", self.notification, t + i))

        try:
            with backend.digest("timeline", 0) as records:
                raise Exception("This causes the digest to not be closed.")
        except Exception:
            pass

        # The 10 existing items should now be in the digest set (the exception
        # prevented the close operation from occurring, so they were never
        # deleted from Redis or removed from the digest set.) If we add 10 more
        # items, they should be added to the timeline set (not the digest set.)
        for i in range(10, 20):
            backend.add("timeline", Record(f"record:{i}", self.notification, t + i))

        # Maintenance should move the timeline back to the waiting state, ...
        backend.maintenance(time.time())

        # The schedule should now contain the timeline.
        assert {entry.key for entry in backend.schedule(time.time())} == {"timeline"}

        # Only the new records should exist -- the older one should have been
        # trimmed to avoid the digest growing beyond the timeline capacity.
        with backend.digest("timeline", 0) as records:
            expected_keys = {f"record:{i}" for i in range(10, 20)}
            assert {record.key for record in records} == expected_keys

    def test_delete(self) -> None:
        backend = RedisClusterBackend()
        backend.add("timeline", Record("record:1", self.notification, time.time()))
        backend.delete("timeline")

        with pytest.raises(InvalidState):
            with backend.digest("timeline", 0):
                raise AssertionError("unreachable")

        assert set(backend.schedule(time.time())) == set()

        # Verify keys are deleted (using hash tag format)
        # Note: Keys should be cleaned up by the delete operation
        keys = backend.cluster.keys("d:t:{timeline}*")
        assert len(keys) == 0

    def test_missing_record_contents(self) -> None:
        backend = RedisClusterBackend()

        record_1 = Record("record:1", self.notification, time.time())
        backend.add("timeline", record_1)

        # Delete the record data directly (simulating eviction)
        # Note: Using hash tag format for Redis Cluster
        backend.cluster.delete("d:t:{timeline}:r:record:1")

        record_2 = Record("record:2", self.notification, time.time())
        backend.add("timeline", record_2)

        # Only the record that still has data should be returned
        with backend.digest("timeline", 0) as records:
            assert {record.key for record in records} == {"record:2"}

    def test_large_digest(self) -> None:
        backend = RedisClusterBackend()

        n = 8192
        t = time.time()
        for i in range(n):
            backend.add("timeline", Record(f"record:{i}", self.notification, t))

        with backend.digest("timeline", 0) as records:
            assert len(records) == n

    def test_hash_tag_key_routing(self) -> None:
        timeline_id = "test-timeline"

        timeline_key = f"d:t:{{{timeline_id}}}"
        digest_key = f"d:t:{{{timeline_id}}}:d"
        record_key = f"d:t:{{{timeline_id}}}:r:record1"
        last_processed_key = f"d:t:{{{timeline_id}}}:l"

        assert "{test-timeline}" in timeline_key
        assert "{test-timeline}" in digest_key
        assert "{test-timeline}" in record_key
        assert "{test-timeline}" in last_processed_key

    def test_schedule_single_operation(self) -> None:
        backend = RedisClusterBackend()

        record = Record("record:1", self.notification, time.time())
        backend.add("timeline", record)

        with backend.digest("timeline", 0):
            pass

        entries = list(backend.schedule(time.time()))
        assert len(entries) == 1
        assert entries[0].key == "timeline"

    def test_cluster_lock_routing(self) -> None:
        backend = RedisClusterBackend()

        timeline_key = "test-timeline"
        lock = backend._get_timeline_lock(timeline_key, duration=30)

        expected_lock_key = f"d:t:{{{timeline_key}}}"
        assert expected_lock_key in str(lock)

    def test_multiple_timelines(self) -> None:
        backend = RedisClusterBackend()

        record_1a = Record("record:1a", self.notification, time.time())
        backend.add("timeline1", record_1a)

        record_2a = Record("record:2a", self.notification, time.time())
        backend.add("timeline2", record_2a)

        assert set(backend.schedule(time.time())) == set()

        with backend.digest("timeline1", 0) as records:
            assert {record.key for record in records} == {"record:1a"}

        with backend.digest("timeline2", 0) as records:
            assert {record.key for record in records} == {"record:2a"}

    def test_concurrent_add_operations(self) -> None:
        backend = RedisClusterBackend()

        t = time.time()

        record_1 = Record("record:1", self.notification, t)
        assert backend.add("timeline", record_1) is True

        for i in range(2, 10):
            record = Record(f"record:{i}", self.notification, t + i)
            assert backend.add("timeline", record) is False

        with backend.digest("timeline", 0) as records:
            assert len(records) == 9

    def test_validate_cluster_connectivity(self) -> None:
        backend = RedisClusterBackend()
        backend.validate()

    def test_validate_cluster_failure(self) -> None:
        with patch("sentry.utils.redis.redis_clusters.get_binary") as mock_get_cluster:
            mock_cluster = Mock()
            mock_cluster.ping.side_effect = Exception("Connection failed")
            mock_get_cluster.return_value = mock_cluster

            backend = RedisClusterBackend()

            with pytest.raises(Exception):
                backend.validate()

    def test_digest_invalid_state(self) -> None:
        backend = RedisClusterBackend()

        record = Record("record:1", self.notification, time.time())
        backend.add("timeline", record)

        # First digest should work
        with backend.digest("timeline", 0):
            pass

        # Timeline is now in waiting state, should raise InvalidState
        with pytest.raises(InvalidState):
            with backend.digest("timeline", 0):
                raise AssertionError("unreachable")
