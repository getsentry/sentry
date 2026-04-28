from __future__ import annotations

from sentry.dynamic_sampling.per_org.tasks.scheduler import (
    BUCKET_COUNT,
    BUCKET_CURSOR_KEY,
    JITTER_WINDOW_SECONDS,
    _next_bucket_index,
    schedule_per_org_calculations,
    schedule_per_org_calculations_bucket,
)
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import BurstTaskRunner

_BUCKET_TASK_NAME = "sentry.dynamic_sampling.per_org.schedule_per_org_calculations_bucket"


def _drain_dispatched_org_ids(burst) -> list[int]:
    ids = [args[0] for _task, args, _kwargs in burst.queue]
    burst.queue.clear()
    return ids


def _is_bucket_task(task) -> bool:
    return getattr(task, "name", None) == _BUCKET_TASK_NAME


def _run_queued_bucket_tasks(burst) -> int:
    ran = 0
    remaining = []
    pending = list(burst.queue)
    burst.queue.clear()

    for task, args, kwargs in pending:
        if _is_bucket_task(task):
            schedule_per_org_calculations_bucket(*args, **kwargs)
            ran += 1
            continue
        remaining.append((task, args, kwargs))

    burst.queue[:0] = remaining
    return ran


class SchedulePerOrgCalculationsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()
        self.redis.delete(BUCKET_CURSOR_KEY)
        self.addCleanup(self.redis.delete, BUCKET_CURSOR_KEY)

    def create_orgs_across_buckets(self, per_bucket: int = 2) -> dict[int, list[int]]:
        by_bucket: dict[int, list[int]] = {bucket: [] for bucket in range(BUCKET_COUNT)}
        for _ in range(BUCKET_COUNT * per_bucket * 20):
            if all(len(ids) >= per_bucket for ids in by_bucket.values()):
                break
            org = self.create_organization()
            by_bucket[org.id % BUCKET_COUNT].append(org.id)
        assert all(len(ids) >= per_bucket for ids in by_bucket.values())
        return by_bucket

    @override_options(
        {
            "dynamic-sampling.per_org.killswitch": True,
            "dynamic-sampling.per_org.rollout-rate": 1.0,
        }
    )
    def test_is_noop_when_killswitch_engaged(self) -> None:
        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert dispatched == []
        assert self.redis.get(BUCKET_CURSOR_KEY) is None

    @override_options({"dynamic-sampling.per_org.rollout-rate": 0.0})
    def test_does_not_scan_when_rollout_zero(self) -> None:
        self.create_organization()

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert dispatched == []
        assert self.redis.get(BUCKET_CURSOR_KEY) is None

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_queues_next_bucket(self) -> None:
        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()

        assert len(burst.queue) == 1
        task, args, kwargs = burst.queue[0]
        assert _is_bucket_task(task)
        assert args == (0,)
        assert kwargs == {}
        assert int(self.redis.get(BUCKET_CURSOR_KEY)) == 1

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_beat_and_bucket_dispatch_only_next_bucket(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            assert _run_queued_bucket_tasks(burst) == 1
            dispatched = _drain_dispatched_org_ids(burst)

        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == 0
        for org_id in by_bucket[0]:
            assert org_id in dispatched
        for bucket, org_ids in by_bucket.items():
            if bucket == 0:
                continue
            for org_id in org_ids:
                assert org_id not in dispatched

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_bucket_dispatches_only_orgs_in_target_bucket(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)
        target = 3

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(target)
            dispatched = _drain_dispatched_org_ids(burst)

        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == target
        for org_id in by_bucket[target]:
            assert org_id in dispatched
        for bucket, org_ids in by_bucket.items():
            if bucket == target:
                continue
            for org_id in org_ids:
                assert org_id not in dispatched
        assert len(dispatched) >= len(by_bucket[target])
        assert JITTER_WINDOW_SECONDS > 0

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_bucket_skips_inactive_orgs(self) -> None:
        active = self.create_organization()
        pending_deletion = self.create_organization()
        pending_deletion.status = OrganizationStatus.PENDING_DELETION
        pending_deletion.save()

        with BurstTaskRunner() as burst:
            for bucket in range(BUCKET_COUNT):
                schedule_per_org_calculations_bucket(bucket)
            dispatched = _drain_dispatched_org_ids(burst)

        assert active.id in dispatched
        assert pending_deletion.id not in dispatched


class NextBucketIndexTest(TestCase):
    def test_uses_redis_cursor(self) -> None:
        redis = get_redis_client_for_ds()
        redis.delete(BUCKET_CURSOR_KEY)
        self.addCleanup(redis.delete, BUCKET_CURSOR_KEY)

        first_cycle = [_next_bucket_index() for _ in range(BUCKET_COUNT)]
        cursor_after_cycle = redis.get(BUCKET_CURSOR_KEY)
        next_cycle = [_next_bucket_index() for _ in range(2)]
        cursor_after_next_cycle = redis.get(BUCKET_CURSOR_KEY)

        assert first_cycle == list(range(BUCKET_COUNT))
        assert cursor_after_cycle is not None
        assert int(cursor_after_cycle) == 0
        assert next_cycle == [0, 1]
        assert cursor_after_next_cycle is not None
        assert int(cursor_after_next_cycle) == 2
