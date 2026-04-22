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
from sentry.testutils.helpers.task_runner import BurstTaskRunner


def _drain_dispatched_org_ids(burst) -> list[int]:
    """Pop captured (task, args, kwargs) tuples and return just the org ids."""
    ids = [args[0] for _task, args, _kwargs in burst.queue]
    burst.queue.clear()
    return ids


def _active_org_ids() -> set[int]:
    return set(
        Organization.objects.filter(status=OrganizationStatus.ACTIVE).values_list("id", flat=True)
    )


class SchedulePerOrgCalculationsBucketTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        get_redis_client_for_ds().delete(BUCKET_CURSOR_KEY)
        # Test fixtures (and any leakage from earlier tests) leave active orgs
        # behind. Capture them so we only assert on orgs we created here.
        self._preexisting_org_ids = _active_org_ids()

    def _create_orgs_across_buckets(self, per_bucket: int = 3) -> dict[int, list[int]]:
        """Create active orgs until every bucket holds at least `per_bucket`."""
        by_bucket: dict[int, list[int]] = {b: [] for b in range(BUCKET_COUNT)}
        attempts = 0
        max_attempts = BUCKET_COUNT * per_bucket * 20
        while any(len(v) < per_bucket for v in by_bucket.values()) and attempts < max_attempts:
            org = self.create_organization()
            by_bucket[org.id % BUCKET_COUNT].append(org.id)
            attempts += 1
        assert all(len(v) >= per_bucket for v in by_bucket.values()), (
            "could not seed enough orgs across all buckets"
        )
        return by_bucket

    def test_dispatches_only_orgs_in_target_bucket(self) -> None:
        by_bucket = self._create_orgs_across_buckets(per_bucket=3)
        target = 3

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(target)
            dispatched = _drain_dispatched_org_ids(burst)

        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == target, (
                f"org {org_id} dispatched into bucket {target} "
                f"but lives in bucket {org_id % BUCKET_COUNT}"
            )
        for org_id in by_bucket[target]:
            assert org_id in dispatched
        for bucket, ids in by_bucket.items():
            if bucket == target:
                continue
            for org_id in ids:
                assert org_id not in dispatched

    def test_full_cycle_dispatches_every_active_org_exactly_once(self) -> None:
        by_bucket = self._create_orgs_across_buckets(per_bucket=2)
        created_ids: set[int] = {org_id for ids in by_bucket.values() for org_id in ids}

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
        by_bucket = self._create_orgs_across_buckets(per_bucket=2)
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
        by_bucket = self._create_orgs_across_buckets(per_bucket=2)
        target = 7

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations_bucket(target - BUCKET_COUNT)
            dispatched = _drain_dispatched_org_ids(burst)

        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == target
        for org_id in by_bucket[target]:
            assert org_id in dispatched

    def test_empty_bucket_dispatches_nothing(self) -> None:
        org = self.create_organization()
        own_bucket = org.id % BUCKET_COUNT
        empty_bucket = (own_bucket + 1) % BUCKET_COUNT
        # Skip if a pre-existing org happens to live in our chosen bucket;
        # we want a guaranteed-empty bucket without filtering the DB.
        if any(pre_id % BUCKET_COUNT == empty_bucket for pre_id in self._preexisting_org_ids):
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
        raw = self.redis.get(BUCKET_CURSOR_KEY)
        assert raw is not None
        # Stored counter is one ahead of the last returned index because we
        # INCR first and subtract 1 on the way out.
        assert int(raw) == first + 1

    def test_falls_back_when_redis_value_is_not_an_integer(self) -> None:
        # INCR on a non-integer string raises ResponseError. Use that to drive
        # the fallback branch without monkey-patching the redis client.
        self.redis.set(BUCKET_CURSOR_KEY, "not-a-number")
        with pytest.raises(ResponseError):
            self.redis.incr(BUCKET_CURSOR_KEY)

        bucket = _next_bucket_index()
        assert 0 <= bucket < BUCKET_COUNT


class SchedulePerOrgCalculationsTest(TestCase):
    """End-to-end: the cron entry point reads the next bucket from Redis and
    fans the matching orgs out. Verified by inspecting Redis state and the
    captured dispatch queue.
    """

    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()
        self.redis.delete(BUCKET_CURSOR_KEY)

    def _create_orgs_across_buckets(self, per_bucket: int = 2) -> dict[int, list[int]]:
        by_bucket: dict[int, list[int]] = {b: [] for b in range(BUCKET_COUNT)}
        attempts = 0
        max_attempts = BUCKET_COUNT * per_bucket * 20
        while any(len(v) < per_bucket for v in by_bucket.values()) and attempts < max_attempts:
            org = self.create_organization()
            by_bucket[org.id % BUCKET_COUNT].append(org.id)
            attempts += 1
        return by_bucket

    def test_consecutive_calls_serve_consecutive_buckets(self) -> None:
        by_bucket = self._create_orgs_across_buckets(per_bucket=2)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            first = _drain_dispatched_org_ids(burst)
            schedule_per_org_calculations()
            second = _drain_dispatched_org_ids(burst)

        assert all(i % BUCKET_COUNT == 0 for i in first)
        assert all(i % BUCKET_COUNT == 1 for i in second)
        for org_id in by_bucket[0]:
            assert org_id in first
        for org_id in by_bucket[1]:
            assert org_id in second

    def test_full_revolution_covers_every_active_org(self) -> None:
        by_bucket = self._create_orgs_across_buckets(per_bucket=2)
        created_ids = {org_id for ids in by_bucket.values() for org_id in ids}

        with BurstTaskRunner() as burst:
            for _ in range(BUCKET_COUNT):
                schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        dispatched_from_our_orgs = [i for i in dispatched if i in created_ids]
        assert sorted(dispatched_from_our_orgs) == sorted(created_ids)

    def test_resumes_from_existing_cursor(self) -> None:
        # Pre-seed cursor at 5; the very next call should land on bucket 5
        # (because _next_bucket_index returns the just-incremented value
        # minus 1, modulo BUCKET_COUNT).
        self.redis.set(BUCKET_CURSOR_KEY, str(5))
        self._create_orgs_across_buckets(per_bucket=2)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert dispatched, "expected at least one dispatched org"
        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == 5

    def test_jitter_window_is_positive_and_run_succeeds_with_many_orgs(self) -> None:
        # The burst harness only captures (args, kwargs) so we can't read the
        # apply_async countdown directly. The next best guarantee is that the
        # scheduler runs to completion when fanning out a non-trivial number
        # of orgs; this catches regressions like passing a negative window
        # to random.uniform().
        self._create_orgs_across_buckets(per_bucket=3)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert len(dispatched) > 0
        assert JITTER_WINDOW_SECONDS > 0
