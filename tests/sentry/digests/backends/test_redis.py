import time
import uuid
from functools import cached_property
from typing import Any

import pytest

from sentry.digests.backends.base import InvalidState
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.types import Notification, Record
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.redis import use_redis_cluster
from sentry.utils.locking.backends.redis import RedisBlasterLockBackend, RedisClusterLockBackend


class RedisBackendTestCase(TestCase):
    """
    Runs on the "default" redis-blaster cluster. The subclass below runs the
    same tests on redis-cluster.
    """

    def get_backend(self, **options: Any) -> RedisBackend:
        return RedisBackend(**options)

    def get_all_keys(self, backend: RedisBackend) -> list[bytes]:
        return backend._get_connection("timeline").keys(f"{backend.namespace}:*")

    def get_schedule_key(self, backend: RedisBackend, timeline: str, state: str) -> str:
        return f"{backend._get_timeline_namespace(timeline)}:s:{state}"

    @cached_property
    def project(self) -> Project:
        return self.create_project(fire_project_created=True)

    @cached_property
    def notification(self) -> Notification:
        rule = self.create_project_rule(project=self.project)
        return Notification(self.event, (rule.id,), str(uuid.uuid4()))

    def test_basic(self) -> None:
        backend = self.get_backend()

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
        backend = self.get_backend(capacity=2, truncation_chance=1.0)

        records = [Record(f"record:{i}", self.notification, time.time()) for i in range(4)]
        for record in records:
            backend.add("timeline", record)

        with backend.digest("timeline", 0) as records:
            assert {record.key for record in records} == {"record:2", "record:3"}

    def test_maintenance_failure_recovery(self) -> None:
        backend = self.get_backend()

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
        backend = self.get_backend(capacity=10, truncation_chance=0.0)

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
        backend = self.get_backend()
        backend.add("timeline", Record("record:1", self.notification, time.time()))
        backend.delete("timeline")

        with pytest.raises(InvalidState):
            with backend.digest("timeline", 0):
                raise AssertionError("unreachable")

        assert set(backend.schedule(time.time())) == set()
        assert len(self.get_all_keys(backend)) == 0

    def test_missing_record_contents(self) -> None:
        backend = self.get_backend()

        record_1 = Record("record:1", self.notification, time.time())
        backend.add("timeline", record_1)
        backend._get_connection("timeline").delete(
            f"{backend._get_timeline_key('timeline')}:r:record:1"
        )

        record_2 = Record("record:2", self.notification, time.time())
        backend.add("timeline", record_2)

        # The existing and new record should be there because the timeline
        # contents were merged back into the digest.
        with backend.digest("timeline", 0) as records:
            assert {record.key for record in records} == {"record:2"}

    def test_large_digest(self) -> None:
        backend = self.get_backend()

        n = 8192
        t = time.time()
        for i in range(n):
            backend.add("timeline", Record(f"record:{i}", self.notification, t))

        with backend.digest("timeline", 0) as records:
            assert len(records) == n

    def test_schedule_sets_have_an_expiry(self) -> None:
        backend = self.get_backend()
        connection = backend._get_connection("timeline")
        ready_key = self.get_schedule_key(backend, "timeline", "r")
        waiting_key = self.get_schedule_key(backend, "timeline", "w")

        # The first record puts the timeline in the "ready" set.
        backend.add("timeline", Record("record:1", self.notification, time.time()))

        ready_ttl = connection.ttl(ready_key)
        assert ready_ttl > 0
        assert ready_ttl >= backend.ttl

        connection.expire(ready_key, 60)
        assert set(backend.schedule(time.time() - 3600)) == set()
        assert connection.ttl(ready_key) > 60

        connection.expire(ready_key, 60)
        backend.maintenance(time.time() - 3600)
        assert connection.ttl(ready_key) > 60

        # Closing a digest puts the timeline back in the "waiting" set, which
        # also has to carry an expiry.
        with backend.digest("timeline", 0):
            pass

        waiting_ttl = connection.ttl(waiting_key)
        assert waiting_ttl > 0
        assert waiting_ttl >= backend.ttl

        # The ready set is gone now that the timeline went back to the waiting
        # set. A scheduler pass creates it again, so the expiry has to be set
        # after the move. A TTL of -2 means the key is not there.
        assert connection.ttl(ready_key) == -2
        assert {entry.key for entry in backend.schedule(time.time() + 3600)} == {"timeline"}
        assert connection.ttl(ready_key) >= backend.ttl

    def test_pending_digest_is_not_dropped_by_the_schedule_expiry(self) -> None:
        """
        The schedule expiry slides forward on every write to a timeline, so it
        is never shorter than the expiry of the keys the schedule points to.

        This asserts that ordering rather than waiting out a wall clock,
        because Redis counts time to live on the server.
        """
        backend = self.get_backend()
        connection = backend._get_connection("timeline")

        timeline_key = backend._get_timeline_key("timeline")

        records = [Record(f"record:{i}", self.notification, time.time()) for i in range(5)]
        for record in records:
            backend.add("timeline", record)

        schedule_ttl = connection.ttl(self.get_schedule_key(backend, "timeline", "r"))
        assert schedule_ttl >= connection.ttl(timeline_key)
        for record in records:
            assert schedule_ttl >= connection.ttl(f"{timeline_key}:r:{record.key}")

        # Nothing pending was dropped.
        with backend.digest("timeline", 0) as digested:
            assert {record.key for record in digested} == {record.key for record in records}

    def test_key_names(self) -> None:
        """
        The blaster key names must not change, so that existing data stays
        readable.
        """
        backend = self.get_backend()
        connection = backend._get_connection("timeline")
        assert isinstance(backend.locks.backend, RedisBlasterLockBackend)

        backend.add("timeline", Record("record:1", self.notification, time.time()))

        assert connection.exists("d:t:timeline")
        assert connection.exists("d:t:timeline:r:record:1")
        assert connection.zscore("d:s:r", "timeline") is not None

        with backend.digest("timeline", 0):
            pass

        assert connection.exists("d:t:timeline:l")
        assert connection.zscore("d:s:w", "timeline") is not None


class RedisClusterBackendTestCase(RedisBackendTestCase):
    """
    Runs the same tests on a real redis-cluster. Each test uses its own
    namespace, because the test run does not clear the cluster.
    """

    cluster_id = "digests-cluster"

    def setUp(self) -> None:
        super().setUp()
        # The digests Lua script makes key names from the namespace in ARGV, so the key prefix
        # would not reach them. The unique namespace isolates each test instead.
        self.enterContext(use_redis_cluster(self.cluster_id, prefix_keys=False))
        self.namespace = f"d-{uuid.uuid4().hex}"

    def get_backend(self, **options: Any) -> RedisBackend:
        return RedisBackend(cluster=self.cluster_id, namespace=self.namespace, **options)

    def get_all_keys(self, backend: RedisBackend) -> list[bytes]:
        return backend.cluster.keys(f"{{{backend.namespace}:*")

    def test_key_names(self) -> None:
        """
        All keys of a timeline, the schedule partition that holds the
        timeline, and the timeline lock are in one hash slot.
        """
        backend = self.get_backend()
        assert backend.is_redis_cluster
        assert isinstance(backend.locks.backend, RedisClusterLockBackend)

        namespace = backend._get_timeline_namespace("timeline")
        assert namespace.startswith(f"{{{self.namespace}:")
        assert namespace.endswith("}")
        # The partition is a function of the timeline key only.
        assert namespace == self.get_backend()._get_timeline_namespace("timeline")

        backend.add("timeline", Record("record:1", self.notification, time.time()))
        with backend.digest("timeline", 0):
            pass
        backend.add("timeline", Record("record:2", self.notification, time.time()))

        keys = [
            f"{namespace}:t:timeline",
            f"{namespace}:t:timeline:r:record:2",
            f"{namespace}:t:timeline:l",
            f"{namespace}:s:w",
        ]
        for key in keys:
            assert backend.cluster.exists(key)

        nodes = backend.cluster.connection_pool.nodes
        slots = {nodes.keyslot(key) for key in keys}
        slots.add(nodes.keyslot(backend.locks.backend.prefix_key(f"{namespace}:t:timeline")))
        assert len(slots) == 1

    def test_schedule_covers_every_partition(self) -> None:
        backend = self.get_backend(schedule_partitions=4)
        timelines = [f"timeline:{i}" for i in range(16)]

        # The timelines are spread over more than one partition.
        assert len({backend._get_timeline_namespace(key) for key in timelines}) > 1

        for key in timelines:
            backend.add(key, Record("record:1", self.notification, time.time()))
            with backend.digest(key, 0):
                pass
            backend.add(key, Record("record:2", self.notification, time.time()))

        # Every timeline is now in the "waiting" set of its partition, and one
        # scheduler pass moves all of them to the "ready" set.
        assert {entry.key for entry in backend.schedule(time.time() + 3600)} == set(timelines)

        for key in timelines:
            with backend.digest(key, 0) as records:
                assert {record.key for record in records} == {"record:2"}

    def test_invalid_schedule_partitions(self) -> None:
        with pytest.raises(ValueError):
            self.get_backend(schedule_partitions=0)
