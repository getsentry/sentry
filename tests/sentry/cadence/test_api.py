from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from sentry.cadence.api import (
    ScheduledTriggerInfo,
    ScheduledTriggerType,
    clear_schedule,
    cron,
    every,
    get_schedules,
    set_schedule,
)
from sentry.cadence.models import ScheduledTrigger, ScheduleType
from sentry.cadence.registry import TriggerHandler, trigger_type_registry
from sentry.cadence.schedule import Schedule
from sentry.cadence.spread import fire_offset
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.registry import NoRegistrationExistsError

NOW = datetime(2024, 3, 9, 12, 0, tzinfo=UTC)
SEER_WORKFLOW = ScheduledTriggerType.SEER_WORKFLOW


class CadenceApiTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # Fire at scheduled times unless a test registers a spread window.
        self.register(timedelta(0))

    def register(self, spread_window: timedelta) -> None:
        handler = MagicMock(spec=TriggerHandler, spread_window=spread_window)
        self.enterContext(patch.dict(trigger_type_registry.registrations, {SEER_WORKFLOW: handler}))

    def set(self, target_id: int, schedule: Schedule) -> ScheduledTriggerInfo:
        return set_schedule(
            organization_id=self.organization.id,
            trigger_type=SEER_WORKFLOW,
            target_id=target_id,
            schedule=schedule,
        )

    def get(self, target_id: int) -> ScheduledTriggerInfo | None:
        return get_schedules(
            organization_id=self.organization.id,
            trigger_type=SEER_WORKFLOW,
            target_ids=[target_id],
        ).get(target_id)


class SetScheduleTest(CadenceApiTestCase):
    @freeze_time(NOW)
    def test_creates_interval_schedule(self) -> None:
        info = self.set(7, every(timedelta(hours=2)))

        assert info == ScheduledTriggerInfo(
            target_id=7,
            schedule=every(timedelta(hours=2)),
            next_fire_at=NOW + timedelta(hours=2),
            next_scheduled_for=NOW + timedelta(hours=2),
        )
        trigger = ScheduledTrigger.objects.get(organization_id=self.organization.id, target_id=7)
        assert trigger.trigger_type == SEER_WORKFLOW
        assert trigger.schedule_type == ScheduleType.INTERVAL
        assert trigger.interval_seconds == 7200
        assert trigger.cron_expression is None
        assert trigger.min_gap_seconds == 7200

    @freeze_time(NOW)
    def test_creates_cron_schedule(self) -> None:
        info = self.set(7, cron("0 9 * * *", "America/New_York"))

        assert info == ScheduledTriggerInfo(
            target_id=7,
            schedule=cron("0 9 * * *", "America/New_York"),
            next_fire_at=datetime(2024, 3, 9, 14, 0, tzinfo=UTC),
            next_scheduled_for=datetime(2024, 3, 9, 14, 0, tzinfo=UTC),
        )
        trigger = ScheduledTrigger.objects.get(organization_id=self.organization.id, target_id=7)
        assert trigger.schedule_type == ScheduleType.CRON
        assert trigger.interval_seconds is None
        assert trigger.cron_expression == "0 9 * * *"
        assert trigger.timezone == "America/New_York"
        # 23 hours when the clocks go forward.
        assert trigger.min_gap_seconds == 23 * 60 * 60

    def test_pulls_in_next_firing_beyond_new_interval(self) -> None:
        with freeze_time(NOW):
            self.set(7, every(timedelta(hours=1)))
        later = NOW + timedelta(minutes=1)
        with freeze_time(later):
            info = self.set(7, every(timedelta(minutes=30)))

        assert info.schedule == every(timedelta(minutes=30))
        assert info.next_fire_at == later + timedelta(minutes=30)
        assert self.get(7) == info

    def test_keeps_next_firing_within_new_interval(self) -> None:
        with freeze_time(NOW):
            self.set(7, every(timedelta(hours=1)))
        with freeze_time(NOW + timedelta(minutes=55)):
            info = self.set(7, every(timedelta(minutes=30)))

        assert info.next_fire_at == NOW + timedelta(hours=1)

    def test_same_schedule_is_unchanged(self) -> None:
        with freeze_time(NOW):
            first = self.set(7, cron("0 * * * *"))
        # Even after its firing comes due, setting the same schedule doesn't move it.
        with freeze_time(NOW + timedelta(hours=1, minutes=5)):
            again = self.set(7, cron("0 * * * *"))

        assert again == first
        assert again.next_fire_at == NOW + timedelta(hours=1)

    def test_interval_to_cron(self) -> None:
        with freeze_time(NOW):
            self.set(7, every(timedelta(hours=1)))
            info = self.set(7, cron("0 10 * * *"))

        assert info.schedule == cron("0 10 * * *")
        assert info.next_fire_at == datetime(2024, 3, 10, 10, 0, tzinfo=UTC)
        trigger = ScheduledTrigger.objects.get(organization_id=self.organization.id, target_id=7)
        assert trigger.interval_seconds is None

    def test_cron_to_interval(self) -> None:
        with freeze_time(NOW):
            self.set(7, cron("0 10 * * *", "America/New_York"))
            info = self.set(7, every(timedelta(hours=1)))

        assert info.schedule == every(timedelta(hours=1))
        assert info.next_fire_at == NOW + timedelta(hours=1)
        trigger = ScheduledTrigger.objects.get(organization_id=self.organization.id, target_id=7)
        assert trigger.cron_expression is None
        assert trigger.timezone == "UTC"

    def test_concurrent_create_updates_instead(self) -> None:
        with freeze_time(NOW):
            self.set(7, every(timedelta(hours=1)))
            # Simulate losing a race: the first lookup misses the row another call created.
            real_get_or_none = ScheduledTrigger.objects.get_or_none
            with patch.object(
                type(ScheduledTrigger.objects.select_for_update()),
                "get_or_none",
                side_effect=[None, real_get_or_none(target_id=7)],
            ):
                info = self.set(7, every(timedelta(minutes=30)))

        assert info.schedule == every(timedelta(minutes=30))
        assert ScheduledTrigger.objects.filter(target_id=7).count() == 1

    def test_targets_are_separate_per_organization(self) -> None:
        other_org = self.create_organization()
        self.set(7, every(timedelta(hours=1)))
        set_schedule(
            organization_id=other_org.id,
            trigger_type=SEER_WORKFLOW,
            target_id=7,
            schedule=every(timedelta(hours=2)),
        )

        info = self.get(7)
        assert info is not None
        assert info.schedule == every(timedelta(hours=1))
        assert ScheduledTrigger.objects.filter(target_id=7).count() == 2

    def test_unregistered_trigger_type_raises(self) -> None:
        with patch.dict(trigger_type_registry.registrations, clear=True):
            with pytest.raises(NoRegistrationExistsError):
                self.set(7, every(timedelta(hours=1)))

        assert not ScheduledTrigger.objects.filter(target_id=7).exists()


class ScheduleSpreadTest(CadenceApiTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.register(timedelta(hours=1))
        # A target whose daily offset is well inside the hour, so the tests below are exact.
        self.target_id = next(
            target_id
            for target_id in range(1, 1000)
            if timedelta(minutes=10) < self.offset(target_id) < timedelta(minutes=50)
        )

    def offset(self, target_id: int, min_gap: timedelta = timedelta(days=1)) -> timedelta:
        return fire_offset(
            organization_id=self.organization.id,
            trigger_type=SEER_WORKFLOW,
            target_id=target_id,
            min_gap=min_gap,
        )

    @freeze_time(NOW)
    def test_daily_cron_runs_offset_after_its_scheduled_time(self) -> None:
        info = self.set(self.target_id, cron("0 13 * * *"))

        scheduled_for = datetime(2024, 3, 9, 13, 0, tzinfo=UTC)
        assert info.next_scheduled_for == scheduled_for
        assert info.next_fire_at == scheduled_for + self.offset(self.target_id)
        assert self.get(self.target_id) == info
        trigger = ScheduledTrigger.objects.get(target_id=self.target_id)
        assert trigger.min_gap_seconds == 24 * 60 * 60

    @freeze_time(NOW)
    def test_interval_runs_offset_after_its_scheduled_time(self) -> None:
        # Two hours apart, so it can use the whole hour.
        info = self.set(self.target_id, every(timedelta(hours=2)))

        assert info.next_scheduled_for == NOW + timedelta(hours=2)
        assert info.next_fire_at == NOW + timedelta(hours=2) + self.offset(self.target_id)

    @freeze_time(NOW)
    def test_frequent_schedule_spreads_over_half_its_gap(self) -> None:
        info = self.set(self.target_id, every(timedelta(minutes=30)))

        assert info.next_scheduled_for is not None
        assert info.next_fire_at is not None
        offset = info.next_fire_at - info.next_scheduled_for
        assert offset == self.offset(self.target_id, min_gap=timedelta(minutes=30))
        assert offset < timedelta(minutes=15)

    def test_cron_keeps_a_passed_scheduled_time_whose_firing_is_still_ahead(self) -> None:
        # 12:00 has passed, but its offset firing hasn't.
        with freeze_time(NOW + timedelta(minutes=1)):
            info = self.set(self.target_id, cron("0 12 * * *"))

        assert info.next_scheduled_for == NOW
        assert info.next_fire_at == NOW + self.offset(self.target_id)

    def test_cron_skips_a_scheduled_time_whose_firing_has_passed(self) -> None:
        with freeze_time(NOW + timedelta(minutes=55)):
            info = self.set(self.target_id, cron("0 12 * * *"))

        assert info.next_scheduled_for == NOW + timedelta(days=1)

    def test_interval_keeps_a_passed_scheduled_time_whose_firing_is_still_ahead(self) -> None:
        with freeze_time(NOW):
            self.set(self.target_id, every(timedelta(hours=2)))
        scheduled_for = NOW + timedelta(hours=2)

        # The scheduled time has passed, but its firing hasn't.
        with freeze_time(scheduled_for + timedelta(minutes=5)):
            info = self.set(self.target_id, every(timedelta(hours=3)))

        assert info.next_scheduled_for == scheduled_for
        assert info.next_fire_at == scheduled_for + self.offset(self.target_id)

    def test_interval_skips_a_scheduled_time_whose_firing_has_passed(self) -> None:
        # A shorter interval shrinks the window, and with it the offset, so the pending
        # scheduled time's firing would already be due.
        frequent = timedelta(minutes=30)
        target_id = next(
            target_id
            for target_id in range(1, 1000)
            if self.offset(target_id, min_gap=timedelta(hours=2))
            > self.offset(target_id, min_gap=frequent) + timedelta(minutes=1)
        )
        with freeze_time(NOW):
            self.set(target_id, every(timedelta(hours=2)))
        scheduled_for = NOW + timedelta(hours=2)
        now = scheduled_for + self.offset(target_id, min_gap=frequent) + timedelta(seconds=30)

        with freeze_time(now):
            info = self.set(target_id, every(frequent))

        assert info.next_scheduled_for == now + frequent
        assert info.next_fire_at == now + frequent + self.offset(target_id, min_gap=frequent)

    @freeze_time(NOW)
    def test_offsets_differ_between_targets(self) -> None:
        offsets = {
            self.set(target_id, cron("0 13 * * *")).next_fire_at for target_id in range(1, 21)
        }

        assert len(offsets) > 1


class GetSchedulesTest(CadenceApiTestCase):
    @freeze_time(NOW)
    def test_returns_schedules_by_target(self) -> None:
        self.set(1, every(timedelta(hours=1)))
        self.set(2, cron("0 10 * * *"))
        self.set(3, every(timedelta(hours=3)))

        schedules = get_schedules(
            organization_id=self.organization.id, trigger_type=SEER_WORKFLOW, target_ids=[1, 2, 4]
        )

        assert schedules == {
            1: ScheduledTriggerInfo(
                target_id=1,
                schedule=every(timedelta(hours=1)),
                next_fire_at=NOW + timedelta(hours=1),
                next_scheduled_for=NOW + timedelta(hours=1),
            ),
            2: ScheduledTriggerInfo(
                target_id=2,
                schedule=cron("0 10 * * *"),
                next_fire_at=datetime(2024, 3, 10, 10, 0, tzinfo=UTC),
                next_scheduled_for=datetime(2024, 3, 10, 10, 0, tzinfo=UTC),
            ),
        }

    def test_scoped_to_organization(self) -> None:
        self.set(1, every(timedelta(hours=1)))
        other_org = self.create_organization()

        assert (
            get_schedules(organization_id=other_org.id, trigger_type=SEER_WORKFLOW, target_ids=[1])
            == {}
        )


class ClearScheduleTest(CadenceApiTestCase):
    def test_clears(self) -> None:
        self.set(7, every(timedelta(hours=1)))

        assert clear_schedule(
            organization_id=self.organization.id, trigger_type=SEER_WORKFLOW, target_id=7
        )
        assert self.get(7) is None

    def test_missing(self) -> None:
        assert not clear_schedule(
            organization_id=self.organization.id, trigger_type=SEER_WORKFLOW, target_id=7
        )

    def test_scoped_to_organization(self) -> None:
        self.set(7, every(timedelta(hours=1)))
        other_org = self.create_organization()

        assert not clear_schedule(
            organization_id=other_org.id, trigger_type=SEER_WORKFLOW, target_id=7
        )
        assert self.get(7) is not None
