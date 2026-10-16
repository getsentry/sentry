import time
import uuid
from functools import cached_property

import pytest

from sentry.digests.backends.base import Backend, InvalidState
from sentry.digests.backends.migrating import MigratingBackend
from sentry.digests.types import Notification, Record
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.redis import use_redis_cluster


class MigratingBackendTestCase(TestCase):
    """
    Moves from the "default" redis-blaster cluster to a real redis-cluster.
    """

    def setUp(self) -> None:
        super().setUp()
        # RedisBackend looks up its cluster when it is built, so build it inside the context.
        self.enterContext(use_redis_cluster("digests-cluster", prefix_keys=False))
        self.backend = MigratingBackend(
            old={"path": "sentry.digests.backends.redis.RedisBackend"},
            new={
                "path": "sentry.digests.backends.redis.RedisBackend",
                "options": {"cluster": "digests-cluster", "namespace": f"d-{uuid.uuid4().hex}"},
            },
        )

    @cached_property
    def notification(self) -> Notification:
        rule = self.create_project_rule(project=self.project)
        return Notification(self.event, (rule.id,), str(uuid.uuid4()))

    def record(self, key: str) -> Record:
        return Record(key, self.notification, time.time())

    def test_add_goes_to_new(self) -> None:
        assert self.backend.new.is_redis_cluster
        assert not self.backend.old.is_redis_cluster

        assert self.backend.add("timeline", self.record("record:1")) is True

        with pytest.raises(InvalidState):
            with self.backend.old.digest("timeline", 0):
                raise AssertionError("unreachable")

        with self.backend.digest("timeline", 0) as records:
            assert [record.key for record in records] == ["record:1"]

    def add_waiting(self, backend: Backend, key: str) -> None:
        backend.add(key, self.record("record:1"))
        with backend.digest(key, 0):
            pass
        backend.add(key, self.record("record:2"))

    def add_stuck_ready(self, backend: Backend, key: str) -> None:
        backend.add(key, self.record("record:1"))
        try:
            with backend.digest(key, 0):
                raise Exception("This causes the digest to not be closed.")
        except Exception:
            pass

    def test_schedule_covers_both(self) -> None:
        self.add_waiting(self.backend.old, "old-timeline")
        self.add_waiting(self.backend.new, "new-timeline")

        # The second add delays each timeline by increment_delay.
        entries = self.backend.schedule(time.time() + 60)
        assert {entry.key for entry in entries} == {"old-timeline", "new-timeline"}

        with self.backend.digest("old-timeline", 0) as records:
            assert [record.key for record in records] == ["record:2"]

    def test_maintenance_covers_both(self) -> None:
        self.add_stuck_ready(self.backend.old, "old-timeline")
        self.add_stuck_ready(self.backend.new, "new-timeline")

        self.backend.maintenance(time.time())

        with pytest.raises(InvalidState):
            with self.backend.old.digest("old-timeline", 0):
                raise AssertionError("unreachable")
        with pytest.raises(InvalidState):
            with self.backend.new.digest("new-timeline", 0):
                raise AssertionError("unreachable")

    def test_delete_removes_from_both(self) -> None:
        self.backend.old.add("timeline", self.record("record:1"))
        self.backend.new.add("timeline", self.record("record:2"))

        self.backend.delete("timeline")

        with pytest.raises(InvalidState):
            with self.backend.old.digest("timeline", 0):
                raise AssertionError("unreachable")
        with pytest.raises(InvalidState):
            with self.backend.new.digest("timeline", 0):
                raise AssertionError("unreachable")
