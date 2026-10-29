from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from sentry.cadence.api import (
    MAX_JITTER,
    ScheduledTriggerInfo,
    ScheduledTriggerType,
    _jitter,
    clear_schedule,
    cron,
    every,
    get_schedules,
    set_schedule,
)
from sentry.cadence.models import ScheduledTrigger, ScheduleType
from sentry.cadence.schedule import Schedule
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time

NOW = datetime(2024, 3, 9, 12, 0, tzinfo=UTC)
SEER_WORKFLOW = ScheduledTriggerType.SEER_WORKFLOW


@pytest.fixture(autouse=True)
def no_jitter() -> Generator[MagicMock]:
    with patch("sentry.cadence.api._jitter", return_value=timedelta(0)) as mock:
        yield mock


def test_jitter_is_bounded() -> None:
    with patch("sentry.cadence.api.random.randint", side_effect=lambda lo, hi: hi):
        assert _jitter(timedelta(minutes=30)) == timedelta(minutes=3)
        assert _jitter(timedelta(weeks=1)) == MAX_JITTER
    with patch("sentry.cadence.api.random.randint", side_effect=lambda lo, hi: lo):
        assert _jitter(timedelta(weeks=1)) == timedelta(0)


class CadenceApiTestCase(TestCase):
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
            target_id=7, schedule=every(timedelta(hours=2)), next_run_at=NOW + timedelta(hours=2)
        )
        trigger = ScheduledTrigger.objects.get(organization_id=self.organization.id, target_id=7)
        assert trigger.trigger_type == SEER_WORKFLOW
        assert trigger.schedule_type == ScheduleType.INTERVAL
        assert trigger.interval_seconds == 7200
        assert trigger.cron_expression is None

    @freeze_time(NOW)
    def test_adds_jitter_to_first_interval_run(self) -> None:
        with patch("sentry.cadence.api._jitter", return_value=timedelta(seconds=42)) as jitter:
            info = self.set(7, every(timedelta(hours=2)))

        jitter.assert_called_once_with(timedelta(hours=2))
        assert info.next_run_at == NOW + timedelta(hours=2, seconds=42)

    @freeze_time(NOW)
    def test_creates_cron_schedule(self) -> None:
        info = self.set(7, cron("0 9 * * *", "America/New_York"))

        assert info == ScheduledTriggerInfo(
            target_id=7,
            schedule=cron("0 9 * * *", "America/New_York"),
            next_run_at=datetime(2024, 3, 9, 14, 0, tzinfo=UTC),
        )
        trigger = ScheduledTrigger.objects.get(organization_id=self.organization.id, target_id=7)
        assert trigger.schedule_type == ScheduleType.CRON
        assert trigger.interval_seconds is None
        assert trigger.cron_expression == "0 9 * * *"
        assert trigger.timezone == "America/New_York"

    def test_pulls_in_next_run_beyond_new_interval(self) -> None:
        with freeze_time(NOW):
            self.set(7, every(timedelta(hours=1)))
        later = NOW + timedelta(minutes=1)
        with freeze_time(later):
            info = self.set(7, every(timedelta(minutes=30)))

        assert info.schedule == every(timedelta(minutes=30))
        assert info.next_run_at == later + timedelta(minutes=30)
        assert self.get(7) == info

    def test_keeps_next_run_within_new_interval(self) -> None:
        with freeze_time(NOW):
            self.set(7, every(timedelta(hours=1)))
        with freeze_time(NOW + timedelta(minutes=55)):
            info = self.set(7, every(timedelta(minutes=30)))

        assert info.next_run_at == NOW + timedelta(hours=1)

    def test_same_schedule_is_unchanged(self) -> None:
        with freeze_time(NOW):
            first = self.set(7, cron("0 * * * *"))
        # Even after its run comes due, setting the same schedule doesn't move it.
        with freeze_time(NOW + timedelta(hours=1, minutes=5)):
            again = self.set(7, cron("0 * * * *"))

        assert again == first
        assert again.next_run_at == NOW + timedelta(hours=1)

    def test_interval_to_cron(self) -> None:
        with freeze_time(NOW):
            self.set(7, every(timedelta(hours=1)))
            info = self.set(7, cron("0 10 * * *"))

        assert info.schedule == cron("0 10 * * *")
        assert info.next_run_at == datetime(2024, 3, 10, 10, 0, tzinfo=UTC)
        trigger = ScheduledTrigger.objects.get(organization_id=self.organization.id, target_id=7)
        assert trigger.interval_seconds is None

    def test_cron_to_interval(self) -> None:
        with freeze_time(NOW):
            self.set(7, cron("0 10 * * *", "America/New_York"))
            info = self.set(7, every(timedelta(hours=1)))

        assert info.schedule == every(timedelta(hours=1))
        assert info.next_run_at == NOW + timedelta(hours=1)
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
                next_run_at=NOW + timedelta(hours=1),
            ),
            2: ScheduledTriggerInfo(
                target_id=2,
                schedule=cron("0 10 * * *"),
                next_run_at=datetime(2024, 3, 10, 10, 0, tzinfo=UTC),
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
