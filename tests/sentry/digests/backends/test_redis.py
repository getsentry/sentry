import time
import uuid
from functools import cached_property

import pytest

from sentry.digests.backends.base import InvalidState
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.types import Notification, Record
from sentry.models.project import Project
from sentry.testutils.cases import TestCase


class RedisBackendTestCase(TestCase):
    @cached_property
    def project(self) -> Project:
        return self.create_project(fire_project_created=True)

    @cached_property
    def notification(self) -> Notification:
        rule = self.create_project_rule(project=self.project)
        return Notification(self.event, (rule.id,), str(uuid.uuid4()))

    def test_basic(self) -> None:
        backend = RedisBackend()

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
        backend = RedisBackend(capacity=2, truncation_chance=1.0)

        records = [Record(f"record:{i}", self.notification, time.time()) for i in range(4)]
        for record in records:
            backend.add("timeline", record)

        with backend.digest("timeline", 0) as records:
            assert {record.key for record in records} == {"record:2", "record:3"}

    def test_maintenance_failure_recovery(self) -> None:
        backend = RedisBackend()

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
        backend = RedisBackend(capacity=10, truncation_chance=0.0)

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
        backend = RedisBackend()
        backend.add("timeline", Record("record:1", self.notification, time.time()))
        backend.delete("timeline")

        with pytest.raises(InvalidState):
            with backend.digest("timeline", 0):
                raise AssertionError("unreachable")

        assert set(backend.schedule(time.time())) == set()
        assert len(backend._get_connection("timeline").keys("d:*")) == 0

    def test_missing_record_contents(self) -> None:
        backend = RedisBackend()

        record_1 = Record("record:1", self.notification, time.time())
        backend.add("timeline", record_1)
        backend._get_connection("timeline").delete("d:t:timeline:r:record:1")

        record_2 = Record("record:2", self.notification, time.time())
        backend.add("timeline", record_2)

        # The existing and new record should be there because the timeline
        # contents were merged back into the digest.
        with backend.digest("timeline", 0) as records:
            assert {record.key for record in records} == {"record:2"}

    def test_large_digest(self) -> None:
        backend = RedisBackend()

        n = 8192
        t = time.time()
        for i in range(n):
            backend.add("timeline", Record(f"record:{i}", self.notification, t))

        with backend.digest("timeline", 0) as records:
            assert len(records) == n

    def test_schedule_sets_have_an_expiry(self) -> None:
        backend = RedisBackend()
        connection = backend._get_connection("timeline")

        # The first record puts the timeline in the "ready" set.
        backend.add("timeline", Record("record:1", self.notification, time.time()))

        ready_ttl = connection.ttl("d:s:r")
        assert ready_ttl > 0
        assert ready_ttl >= backend.ttl

        connection.expire("d:s:r", 60)
        assert set(backend.schedule(time.time() - 3600)) == set()
        assert connection.ttl("d:s:r") > 60

        connection.expire("d:s:r", 60)
        backend.maintenance(time.time() - 3600)
        assert connection.ttl("d:s:r") > 60

        # Closing a digest puts the timeline back in the "waiting" set, which
        # also has to carry an expiry.
        with backend.digest("timeline", 0):
            pass

        waiting_ttl = connection.ttl("d:s:w")
        assert waiting_ttl > 0
        assert waiting_ttl >= backend.ttl

        # The ready set is gone now that the timeline went back to the waiting
        # set. A scheduler pass creates it again, so the expiry has to be set
        # after the move. A TTL of -2 means the key is not there.
        assert connection.ttl("d:s:r") == -2
        assert {entry.key for entry in backend.schedule(time.time() + 3600)} == {"timeline"}
        assert connection.ttl("d:s:r") >= backend.ttl

    def test_pending_digest_is_not_dropped_by_the_schedule_expiry(self) -> None:
        """
        The schedule expiry slides forward on every write to a timeline, so it
        is never shorter than the expiry of the keys the schedule points to.

        This asserts that ordering rather than waiting out a wall clock,
        because Redis counts time to live on the server.
        """
        backend = RedisBackend()
        connection = backend._get_connection("timeline")

        records = [Record(f"record:{i}", self.notification, time.time()) for i in range(5)]
        for record in records:
            backend.add("timeline", record)

        schedule_ttl = connection.ttl("d:s:r")
        assert schedule_ttl >= connection.ttl("d:t:timeline")
        for record in records:
            assert schedule_ttl >= connection.ttl(f"d:t:timeline:r:{record.key}")

        # Nothing pending was dropped.
        with backend.digest("timeline", 0) as digested:
            assert {record.key for record in digested} == {record.key for record in records}
