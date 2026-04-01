from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from django.core.cache import cache
from django.test import override_settings

from sentry.constants import ObjectStatus
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.cursored_scheduler import (
    BATCH_SIZE_CACHE_KEY_PREFIX,
    CURSOR_CACHE_KEY_PREFIX,
    CursoredScheduler,
    _get_tick_interval,
)

TEST_SCHEDULES = {
    "test-scheduler-beat": {
        "task": "test:sentry.test_task",
        "schedule": timedelta(minutes=1),
    },
    "test-scheduler-beat-5m": {
        "task": "test:sentry.test_task_5m",
        "schedule": timedelta(minutes=5),
    },
    "test-scheduler-beat-slow": {
        "task": "test:sentry.test_task_slow",
        "schedule": timedelta(minutes=1),
    },
}


@control_silo_test
@override_settings(TASKWORKER_SCHEDULES=TEST_SCHEDULES)
class CursoredSchedulerTest(TestCase):
    def setUp(self):
        self.mock_task = MagicMock()
        self.cache_key = f"{CURSOR_CACHE_KEY_PREFIX}:test_scheduler"
        self.batch_size_key = f"{BATCH_SIZE_CACHE_KEY_PREFIX}:test_scheduler"
        cache.delete(self.cache_key)
        cache.delete(self.batch_size_key)

    _oi_counter = 0

    def _create_org_integrations(self, count):
        """Create real OrganizationIntegration rows for testing."""
        integrations = []
        for _ in range(count):
            CursoredSchedulerTest._oi_counter += 1
            org = self.create_organization()
            integration = self.create_integration(
                organization=org,
                external_id=str(CursoredSchedulerTest._oi_counter),
                provider="github",
            )
            oi = OrganizationIntegration.objects.get(
                organization_id=org.id, integration=integration
            )
            integrations.append(oi)
        return integrations

    def _make_scheduler(
        self,
        queryset=None,
        cycle_duration=timedelta(minutes=3),
        schedule_key="test-scheduler-beat",
    ):
        """
        Default: 3-minute cycle with 1-minute tick interval (from schedule) = 3 ticks per cycle.
        Batch size = ceil(total_rows / 3).
        """
        if queryset is None:
            queryset = OrganizationIntegration.objects.filter(
                integration__provider="github",
                status=ObjectStatus.ACTIVE,
            )
        return CursoredScheduler(
            name="test_scheduler",
            schedule_key=schedule_key,
            queryset=queryset,
            task=self.mock_task,
            cycle_duration=cycle_duration,
        )

    def test_calculates_batch_size(self):
        """With 30 items, 3-min cycle, 1-min tick → batch_size=10."""
        ois = self._create_org_integrations(30)
        scheduler = self._make_scheduler()

        scheduler.tick()

        assert self.mock_task.delay.call_count == 10
        dispatched_pks = [c.args[0] for c in self.mock_task.delay.call_args_list]
        assert dispatched_pks == [oi.pk for oi in ois[:10]]

    def test_advances_cursor_between_ticks(self):
        ois = self._create_org_integrations(30)
        scheduler = self._make_scheduler()

        scheduler.tick()
        first_batch_pks = [c.args[0] for c in self.mock_task.delay.call_args_list]
        assert first_batch_pks == [oi.pk for oi in ois[:10]]
        self.mock_task.reset_mock()

        scheduler.tick()

        dispatched_pks = [c.args[0] for c in self.mock_task.delay.call_args_list]
        assert dispatched_pks == [oi.pk for oi in ois[10:20]]

    def test_completes_full_cycle(self):
        ois = self._create_org_integrations(30)
        scheduler = self._make_scheduler()

        assert scheduler.tick() is True  # batch 1: 10 items
        assert scheduler.tick() is True  # batch 2: 10 items
        assert scheduler.tick() is True  # batch 3: 10 items (exact batch_size)
        assert scheduler.tick() is False  # batch 4: empty, cycle done

        dispatched_pks = [c.args[0] for c in self.mock_task.delay.call_args_list]
        assert dispatched_pks == [oi.pk for oi in ois]

    def test_resets_after_cycle_completes(self):
        ois = self._create_org_integrations(30)
        scheduler = self._make_scheduler()

        # Complete the cycle
        scheduler.tick()
        scheduler.tick()
        scheduler.tick()
        assert scheduler.tick() is False

        self.mock_task.reset_mock()

        # New cycle should start from beginning
        scheduler.tick()
        dispatched_pks = [c.args[0] for c in self.mock_task.delay.call_args_list]
        assert dispatched_pks == [oi.pk for oi in ois[:10]]

    def test_empty_queryset(self):
        scheduler = self._make_scheduler()

        has_more = scheduler.tick()

        assert has_more is False
        self.mock_task.delay.assert_not_called()

    def test_batch_size_cached_across_ticks(self):
        """Batch size is calculated once at cycle start, not every tick."""
        self._create_org_integrations(30)
        scheduler = self._make_scheduler()

        scheduler.tick()

        cached_size = cache.get(self.batch_size_key)
        assert cached_size is not None
        assert int(cached_size) == 10

    def test_batch_size_recalculated_on_new_cycle(self):
        """After cycle completes and resets, batch size is recalculated."""
        self._create_org_integrations(30)
        scheduler = self._make_scheduler()

        # Complete the cycle
        scheduler.tick()
        scheduler.tick()
        scheduler.tick()
        assert scheduler.tick() is False  # empty, cycle done

        # Add more items — now 60 total, batch_size should be 20
        self._create_org_integrations(30)

        self.mock_task.reset_mock()

        scheduler.tick()
        assert self.mock_task.delay.call_count == 20

    def test_reads_tick_interval_from_schedule(self):
        """Tick interval is read from TASKWORKER_SCHEDULES, not passed directly."""
        self._create_org_integrations(30)

        # 5-min tick interval, 5-min cycle → 1 tick per cycle → batch_size=30
        scheduler = self._make_scheduler(
            cycle_duration=timedelta(minutes=5),
            schedule_key="test-scheduler-beat-5m",
        )

        scheduler.tick()
        assert self.mock_task.delay.call_count == 30

    def test_cursor_survives_across_instances(self):
        ois = self._create_org_integrations(30)
        qs = OrganizationIntegration.objects.filter(
            integration__provider="github",
            status=ObjectStatus.ACTIVE,
        )

        scheduler1 = CursoredScheduler(
            name="shared_key",
            schedule_key="test-scheduler-beat",
            queryset=qs,
            task=self.mock_task,
            cycle_duration=timedelta(minutes=3),
        )
        scheduler1.tick()
        self.mock_task.reset_mock()

        scheduler2 = CursoredScheduler(
            name="shared_key",
            schedule_key="test-scheduler-beat",
            queryset=qs,
            task=self.mock_task,
            cycle_duration=timedelta(minutes=3),
        )
        scheduler2.tick()

        dispatched_pks = [c.args[0] for c in self.mock_task.delay.call_args_list]
        assert dispatched_pks == [oi.pk for oi in ois[10:20]]

    def test_different_names_are_independent(self):
        self._create_org_integrations(30)
        qs = OrganizationIntegration.objects.filter(
            integration__provider="github",
            status=ObjectStatus.ACTIVE,
        )
        task_a = MagicMock()
        task_b = MagicMock()

        # sched_a: 5-min tick, 5-min cycle → 1 tick → batch 30
        scheduler_a = CursoredScheduler(
            name="sched_a",
            schedule_key="test-scheduler-beat-5m",
            queryset=qs,
            task=task_a,
            cycle_duration=timedelta(minutes=5),
        )
        # sched_b: 1-min tick, 2-min cycle → 2 ticks → batch 15
        scheduler_b = CursoredScheduler(
            name="sched_b",
            schedule_key="test-scheduler-beat",
            queryset=qs,
            task=task_b,
            cycle_duration=timedelta(minutes=2),
        )

        scheduler_a.tick()
        scheduler_b.tick()

        assert task_a.delay.call_count == 30
        assert task_b.delay.call_count == 15

    def test_dispatches_pks_not_objects(self):
        self._create_org_integrations(30)
        scheduler = self._make_scheduler()

        scheduler.tick()

        for c in self.mock_task.delay.call_args_list:
            assert isinstance(c.args[0], int)

    def test_respects_queryset_filtering(self):
        """Only items matching the queryset are processed."""
        ois = self._create_org_integrations(30)

        # Disable one
        ois[5].update(status=ObjectStatus.DISABLED)

        scheduler = self._make_scheduler()
        scheduler.tick()

        dispatched_pks = [c.args[0] for c in self.mock_task.delay.call_args_list]
        assert ois[5].pk not in dispatched_pks

    def test_lock_contention_skips_tick(self):
        """If lock is held by another tick, skip without processing."""
        self._create_org_integrations(30)
        scheduler = self._make_scheduler()

        from sentry.locks import locks

        lock = locks.get(
            key=scheduler.lock_key,
            duration=60,
            name="test_contention",
        )
        with lock.acquire():
            has_more = scheduler.tick()

        assert has_more is False
        self.mock_task.delay.assert_not_called()

    def test_min_batch_size(self):
        """Batch size is at least 1, even when math would produce < 1."""
        self._create_org_integrations(3)
        # 1-min tick, 100-min cycle, 3 items → ceil(3/100) = 1
        scheduler = self._make_scheduler(
            cycle_duration=timedelta(minutes=100),
        )

        # batch_size=1, so 3 ticks to process all 3 items
        assert scheduler.tick() is True
        assert self.mock_task.delay.call_count == 1

        scheduler.tick()
        scheduler.tick()
        assert self.mock_task.delay.call_count == 3


@override_settings(TASKWORKER_SCHEDULES=TEST_SCHEDULES)
class GetTickIntervalTest(TestCase):
    def test_reads_timedelta_schedule(self):
        interval = _get_tick_interval("test-scheduler-beat")
        assert interval == timedelta(minutes=1)

    def test_reads_different_interval(self):
        interval = _get_tick_interval("test-scheduler-beat-5m")
        assert interval == timedelta(minutes=5)

    def test_errors_on_missing_key(self):
        with pytest.raises(ValueError, match="not found"):
            _get_tick_interval("nonexistent-key")

    @override_settings(
        TASKWORKER_SCHEDULES={
            "crontab-schedule": {
                "task": "test:task",
                "schedule": "not-a-timedelta",
            },
        }
    )
    def test_errors_on_non_timedelta_schedule(self):
        with pytest.raises(TypeError, match="requires a timedelta"):
            _get_tick_interval("crontab-schedule")
