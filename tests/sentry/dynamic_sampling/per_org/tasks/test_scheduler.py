from __future__ import annotations

import pytest
from redis.exceptions import ResponseError

from sentry.dynamic_sampling.per_org.tasks.scheduler import (
    BUCKET_COUNT,
    BUCKET_CURSOR_KEY,
    JITTER_WINDOW_SECONDS,
    _next_bucket_index,
    schedule_per_org_calculations,
    schedule_per_org_calculations_bucket,
)
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.models.organization import Organization, OrganizationStatus
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
    """Execute every bucket task currently queued, returning how many ran.

    After ``schedule_per_org_calculations`` the queue holds a bucket task per
    call; running them materialises the per-org dispatches into the queue so
    the existing assertions about dispatched org ids keep working.
    """
    ran = 0
    remaining: list = []
    pending = list(burst.queue)
    burst.queue.clear()
    for task, args, kwargs in pending:
        if _is_bucket_task(task):
            schedule_per_org_calculations_bucket(*args, **kwargs)
            ran += 1
        else:
            remaining.append((task, args, kwargs))
    burst.queue[:0] = remaining
    return ran


def _active_org_ids() -> set[int]:
    return set(
        Organization.objects.filter(status=OrganizationStatus.ACTIVE).values_list("id", flat=True)
    )


def _read_cursor(redis) -> int | None:
    raw = redis.get(BUCKET_CURSOR_KEY)
    return int(raw) if raw is not None else None


class _SchedulerTestBase(TestCase):
    """Shared fixture: reset the cursor, pin rollout to 100% by default."""

    rollout_rate = 1.0

    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()
        self.redis.delete(BUCKET_CURSOR_KEY)
        self.enterContext(
            override_options({"dynamic-sampling.per_org.rollout-rate": self.rollout_rate})
        )

    def create_orgs_across_buckets(self, per_bucket: int = 2) -> dict[int, list[int]]:
        """Create active orgs until every bucket holds at least `per_bucket`."""
        by_bucket: dict[int, list[int]] = {b: [] for b in range(BUCKET_COUNT)}
        max_attempts = BUCKET_COUNT * per_bucket * 20
        for _ in range(max_attempts):
            if all(len(v) >= per_bucket for v in by_bucket.values()):
                break
            org = self.create_organization()
            by_bucket[org.id % BUCKET_COUNT].append(org.id)
        assert all(len(v) >= per_bucket for v in by_bucket.values()), (
            "could not seed enough orgs across all buckets"
        )
        return by_bucket

    def create_orgs_in_bucket(self, bucket: int, count: int) -> list[int]:
        ids: list[int] = []
        max_attempts = count * BUCKET_COUNT * 20
        for _ in range(max_attempts):
            if len(ids) == count:
                break
            org = self.create_organization()
            if org.id % BUCKET_COUNT == bucket:
                ids.append(org.id)
        assert len(ids) == count, "could not seed enough orgs in the target bucket"
        return ids


class SchedulePerOrgCalculationsBucketTest(_SchedulerTestBase):
    def test_dispatches_only_orgs_in_target_bucket(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=3)
        target = 3

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(target)
            dispatched = _drain_dispatched_org_ids(burst)

        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == target
        for org_id in by_bucket[target]:
            assert org_id in dispatched
        for bucket, ids in by_bucket.items():
            if bucket == target:
                continue
            for org_id in ids:
                assert org_id not in dispatched

    def test_full_cycle_dispatches_every_active_org_exactly_once(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)
        created_ids = {org_id for ids in by_bucket.values() for org_id in ids}

        with BurstTaskRunner() as burst:
            for bucket in range(BUCKET_COUNT):
                schedule_per_org_calculations_bucket(bucket)
            all_dispatched = _drain_dispatched_org_ids(burst)

        dispatched_from_our_orgs = [i for i in all_dispatched if i in created_ids]
        assert sorted(dispatched_from_our_orgs) == sorted(created_ids)
        for org_id in created_ids:
            assert dispatched_from_our_orgs.count(org_id) == 1

    def test_inactive_orgs_are_not_dispatched(self) -> None:
        active = self.create_organization()
        pending_deletion = self.create_organization()
        pending_deletion.status = OrganizationStatus.PENDING_DELETION
        pending_deletion.save()
        deletion_in_progress = self.create_organization()
        deletion_in_progress.status = OrganizationStatus.DELETION_IN_PROGRESS
        deletion_in_progress.save()

        with BurstTaskRunner() as burst:
            for bucket in range(BUCKET_COUNT):
                schedule_per_org_calculations_bucket(bucket)
            dispatched = _drain_dispatched_org_ids(burst)

        assert active.id in dispatched
        assert pending_deletion.id not in dispatched
        assert deletion_in_progress.id not in dispatched

    def test_out_of_range_bucket_index_is_wrapped(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)
        target = 3

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(target + BUCKET_COUNT)
            dispatched_wrapped = _drain_dispatched_org_ids(burst)
            schedule_per_org_calculations_bucket(target)
            dispatched_direct = _drain_dispatched_org_ids(burst)

        assert sorted(dispatched_wrapped) == sorted(dispatched_direct)
        for org_id in by_bucket[target]:
            assert org_id in dispatched_wrapped

    def test_negative_bucket_index_is_wrapped(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)
        target = 7

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(target - BUCKET_COUNT)
            dispatched = _drain_dispatched_org_ids(burst)

        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == target
        for org_id in by_bucket[target]:
            assert org_id in dispatched

    def test_empty_bucket_dispatches_nothing(self) -> None:
        preexisting = _active_org_ids()
        org = self.create_organization()
        own_bucket = org.id % BUCKET_COUNT
        empty_bucket = (own_bucket + 1) % BUCKET_COUNT
        if any(pre_id % BUCKET_COUNT == empty_bucket for pre_id in preexisting):
            pytest.skip("pre-existing org collides with the chosen empty bucket")

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(empty_bucket)
            dispatched = _drain_dispatched_org_ids(burst)

        assert org.id not in dispatched
        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == empty_bucket


class NextBucketIndexTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()
        self.redis.delete(BUCKET_CURSOR_KEY)

    def test_first_call_returns_zero(self) -> None:
        assert _next_bucket_index() == 0

    def test_consecutive_calls_return_monotonic_sequence(self) -> None:
        observed = [_next_bucket_index() for _ in range(BUCKET_COUNT)]
        assert observed == list(range(BUCKET_COUNT))

    def test_cursor_wraps_at_bucket_count(self) -> None:
        observed = [_next_bucket_index() for _ in range(BUCKET_COUNT * 2 + 3)]
        expected = [i % BUCKET_COUNT for i in range(BUCKET_COUNT * 2 + 3)]
        assert observed == expected

    def test_cursor_persists_across_calls(self) -> None:
        first = _next_bucket_index()
        # Stored counter is one ahead of the last returned index because we
        # INCR first and subtract 1 on the way out.
        assert _read_cursor(self.redis) == first + 1

    def test_falls_back_when_redis_value_is_not_an_integer(self) -> None:
        # INCR on a non-integer string raises ResponseError. Use that to drive
        # the fallback branch without monkey-patching the redis client.
        self.redis.set(BUCKET_CURSOR_KEY, "not-a-number")
        with pytest.raises(ResponseError):
            self.redis.incr(BUCKET_CURSOR_KEY)

        bucket = _next_bucket_index()
        assert 0 <= bucket < BUCKET_COUNT


class SchedulePerOrgCalculationsTest(_SchedulerTestBase):
    """End-to-end: the beat entry reads the next bucket from Redis and fans
    the matching orgs out.
    """

    def test_consecutive_calls_serve_consecutive_buckets(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            _run_queued_bucket_tasks(burst)
            first = _drain_dispatched_org_ids(burst)
            schedule_per_org_calculations()
            _run_queued_bucket_tasks(burst)
            second = _drain_dispatched_org_ids(burst)

        assert all(i % BUCKET_COUNT == 0 for i in first)
        assert all(i % BUCKET_COUNT == 1 for i in second)
        for org_id in by_bucket[0]:
            assert org_id in first
        for org_id in by_bucket[1]:
            assert org_id in second

    def test_full_revolution_covers_every_active_org(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)
        created_ids = {org_id for ids in by_bucket.values() for org_id in ids}

        with BurstTaskRunner() as burst:
            for _ in range(BUCKET_COUNT):
                schedule_per_org_calculations()
            _run_queued_bucket_tasks(burst)
            dispatched = _drain_dispatched_org_ids(burst)

        dispatched_from_our_orgs = [i for i in dispatched if i in created_ids]
        assert sorted(dispatched_from_our_orgs) == sorted(created_ids)

    def test_resumes_from_existing_cursor(self) -> None:
        # Pre-seed cursor at 5; the very next call should land on bucket 5
        # (because _next_bucket_index returns the just-incremented value
        # minus 1, modulo BUCKET_COUNT).
        self.redis.set(BUCKET_CURSOR_KEY, str(5))
        self.create_orgs_across_buckets(per_bucket=2)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            _run_queued_bucket_tasks(burst)
            dispatched = _drain_dispatched_org_ids(burst)

        assert dispatched
        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == 5

    def test_jitter_window_is_positive_and_run_succeeds_with_many_orgs(self) -> None:
        # The burst harness only captures (args, kwargs) so we can't read the
        # apply_async countdown directly. The next best guarantee is that the
        # scheduler runs to completion when fanning out a non-trivial number
        # of orgs; this catches regressions like passing a negative window to
        # random.uniform().
        self.create_orgs_across_buckets(per_bucket=3)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            _run_queued_bucket_tasks(burst)
            dispatched = _drain_dispatched_org_ids(burst)

        assert len(dispatched) > 0
        assert JITTER_WINDOW_SECONDS > 0


class SchedulerRetrySafetyTest(_SchedulerTestBase):
    """Regression coverage for the split-dispatch contract.

    The beat entry advances the cursor exactly once and hands the resulting
    ``bucket_index`` to a retryable fan-out task. If either contract breaks
    (cursor advanced inside the retryable task, or the beat entry retries) a
    transient failure would silently skip a bucket for that revolution.
    """

    def test_beat_entry_task_has_retries_disabled(self) -> None:
        retry = schedule_per_org_calculations.retry
        assert retry is not None
        assert retry._times == 0

    def test_bucket_task_accepts_bucket_index_as_argument(self) -> None:
        # If bucket_index weren't an argument, a retry would have to recompute
        # it and would therefore touch the cursor again.
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)
        target = 4

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(target)
            dispatched = _drain_dispatched_org_ids(burst)

        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == target
        for org_id in by_bucket[target]:
            assert org_id in dispatched

    def test_bucket_task_retry_does_not_advance_cursor(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)
        target = 6
        self.redis.set(BUCKET_CURSOR_KEY, str(target + 1))
        cursor_before = _read_cursor(self.redis)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(target)
            first = _drain_dispatched_org_ids(burst)
            schedule_per_org_calculations_bucket(target)
            second = _drain_dispatched_org_ids(burst)

        assert _read_cursor(self.redis) == cursor_before
        assert sorted(first) == sorted(second)
        for org_id in first + second:
            assert org_id % BUCKET_COUNT == target
        for org_id in by_bucket[target]:
            assert org_id in first

    def test_beat_entry_advances_cursor_exactly_once_per_call(self) -> None:
        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            cursor_after_first = _read_cursor(self.redis)
            _run_queued_bucket_tasks(burst)
            cursor_after_bucket = _read_cursor(self.redis)

        assert cursor_after_first == 1
        assert cursor_after_bucket == 1

    def test_full_revolution_unaffected_by_bucket_task_retries(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)
        created_ids = {org_id for ids in by_bucket.values() for org_id in ids}

        with BurstTaskRunner() as burst:
            for _ in range(BUCKET_COUNT):
                schedule_per_org_calculations()
            # Run every queued bucket task twice to simulate a retry after a
            # transient failure.
            queued = list(burst.queue)
            burst.queue.clear()
            for task, args, kwargs in queued:
                if _is_bucket_task(task):
                    schedule_per_org_calculations_bucket(*args, **kwargs)
                    schedule_per_org_calculations_bucket(*args, **kwargs)
            dispatched = _drain_dispatched_org_ids(burst)

        dispatched_from_our_orgs = sorted(i for i in dispatched if i in created_ids)
        for org_id in created_ids:
            assert dispatched_from_our_orgs.count(org_id) == 2
        assert _read_cursor(self.redis) == BUCKET_COUNT


class SchedulerKillswitchAndRolloutTest(_SchedulerTestBase):
    """The killswitch must neutralise both scheduler stages, and the rollout
    rate must deterministically gate per-org dispatch.
    """

    @override_options(
        {
            "dynamic-sampling.per_org.killswitch": True,
            "dynamic-sampling.per_org.rollout-rate": 1.0,
        }
    )
    def test_beat_entry_is_noop_when_killswitch_engaged(self) -> None:
        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            queued = list(burst.queue)
            burst.queue.clear()

        assert queued == []
        assert self.redis.get(BUCKET_CURSOR_KEY) is None

    @override_options(
        {
            "dynamic-sampling.per_org.killswitch": True,
            "dynamic-sampling.per_org.rollout-rate": 1.0,
        }
    )
    def test_bucket_task_is_noop_when_killswitch_engaged(self) -> None:
        self.create_orgs_in_bucket(bucket=2, count=2)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(2)
            dispatched = _drain_dispatched_org_ids(burst)

        assert dispatched == []

    @override_options({"dynamic-sampling.per_org.rollout-rate": 0.0})
    def test_rollout_at_zero_dispatches_nothing(self) -> None:
        self.create_orgs_in_bucket(bucket=5, count=3)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(5)
            dispatched = _drain_dispatched_org_ids(burst)

        assert dispatched == []

    def test_rollout_at_one_dispatches_every_org_in_bucket(self) -> None:
        org_ids = self.create_orgs_in_bucket(bucket=8, count=3)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(8)
            dispatched = _drain_dispatched_org_ids(burst)

        for org_id in org_ids:
            assert org_id in dispatched

    def test_rollout_is_deterministic_for_a_given_org(self) -> None:
        # The same (option_value, org_id) pair must produce the same decision
        # every time, so a held-steady rate must not shuffle which orgs run
        # across successive beats.
        org_ids = self.create_orgs_in_bucket(bucket=1, count=5)

        with override_options({"dynamic-sampling.per_org.rollout-rate": 0.5}):
            with BurstTaskRunner() as burst:
                schedule_per_org_calculations_bucket(1)
                first = sorted(i for i in _drain_dispatched_org_ids(burst) if i in org_ids)
                schedule_per_org_calculations_bucket(1)
                second = sorted(i for i in _drain_dispatched_org_ids(burst) if i in org_ids)

        assert first == second
