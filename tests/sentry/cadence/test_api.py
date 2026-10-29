from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from sentry.cadence.api import (
    MAX_JITTER,
    ScheduledTriggerInfo,
    _jitter,
    create_scheduled_trigger,
    delete_scheduled_trigger,
    every,
    get_scheduled_trigger,
    update_schedule,
)
from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType, ScheduleType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time

NOW = datetime(2024, 3, 9, 12, 0, tzinfo=UTC)


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
    def create_hourly(self) -> ScheduledTriggerInfo:
        return create_scheduled_trigger(
            organization_id=self.organization.id,
            trigger_type=ScheduledTriggerType.TRIAGE,
            schedule=every(timedelta(hours=1)),
        )


@freeze_time(NOW)
class CreateScheduledTriggerTest(CadenceApiTestCase):
    def test_creates_interval_trigger(self) -> None:
        info = create_scheduled_trigger(
            organization_id=self.organization.id,
            trigger_type=ScheduledTriggerType.TRIAGE,
            schedule=every(timedelta(hours=2)),
        )
        assert info == ScheduledTriggerInfo(
            id=info.id,
            trigger_type=ScheduledTriggerType.TRIAGE,
            schedule=every(timedelta(hours=2)),
            next_run_at=NOW + timedelta(hours=2),
        )
        trigger = ScheduledTrigger.objects.get(id=info.id)
        assert trigger.organization_id == self.organization.id
        assert trigger.schedule_type == ScheduleType.INTERVAL
        assert trigger.interval_seconds == 7200
        assert trigger.cron_expression is None
        assert trigger.next_run_at == NOW + timedelta(hours=2)

    def test_adds_jitter_to_first_run(self) -> None:
        with patch("sentry.cadence.api._jitter", return_value=timedelta(seconds=42)) as jitter:
            info = create_scheduled_trigger(
                organization_id=self.organization.id,
                trigger_type=ScheduledTriggerType.TRIAGE,
                schedule=every(timedelta(hours=2)),
            )
        jitter.assert_called_once_with(timedelta(hours=2))
        assert info.next_run_at == NOW + timedelta(hours=2, seconds=42)


@freeze_time(NOW)
class GetScheduledTriggerTest(CadenceApiTestCase):
    def test_returns_schedule_and_next_run(self) -> None:
        created = self.create_hourly()
        assert get_scheduled_trigger(
            organization_id=self.organization.id, trigger_id=created.id
        ) == ScheduledTriggerInfo(
            id=created.id,
            trigger_type=ScheduledTriggerType.TRIAGE,
            schedule=every(timedelta(hours=1)),
            next_run_at=NOW + timedelta(hours=1),
        )

    def test_missing(self) -> None:
        assert get_scheduled_trigger(organization_id=self.organization.id, trigger_id=0) is None

    def test_scoped_to_organization(self) -> None:
        created = self.create_hourly()
        other_org = self.create_organization()
        assert get_scheduled_trigger(organization_id=other_org.id, trigger_id=created.id) is None


class UpdateScheduleTest(CadenceApiTestCase):
    def test_pulls_in_next_run_beyond_new_interval(self) -> None:
        with freeze_time(NOW):
            created = self.create_hourly()
        later = NOW + timedelta(minutes=1)
        with freeze_time(later):
            info = update_schedule(
                organization_id=self.organization.id,
                trigger_id=created.id,
                schedule=every(timedelta(minutes=30)),
            )
        assert info is not None
        assert info.schedule == every(timedelta(minutes=30))
        assert info.next_run_at == later + timedelta(minutes=30)
        assert (
            get_scheduled_trigger(organization_id=self.organization.id, trigger_id=created.id)
            == info
        )

    def test_keeps_next_run_within_new_interval(self) -> None:
        with freeze_time(NOW):
            created = self.create_hourly()
        with freeze_time(NOW + timedelta(minutes=55)):
            info = update_schedule(
                organization_id=self.organization.id,
                trigger_id=created.id,
                schedule=every(timedelta(minutes=30)),
            )
        assert info is not None
        assert info.schedule == every(timedelta(minutes=30))
        assert info.next_run_at == NOW + timedelta(hours=1)

    def test_scoped_to_organization(self) -> None:
        created = self.create_hourly()
        other_org = self.create_organization()
        assert (
            update_schedule(
                organization_id=other_org.id,
                trigger_id=created.id,
                schedule=every(timedelta(hours=2)),
            )
            is None
        )
        assert (
            get_scheduled_trigger(organization_id=self.organization.id, trigger_id=created.id)
            == created
        )


class DeleteScheduledTriggerTest(CadenceApiTestCase):
    def test_deletes(self) -> None:
        created = self.create_hourly()
        assert delete_scheduled_trigger(organization_id=self.organization.id, trigger_id=created.id)
        assert (
            get_scheduled_trigger(organization_id=self.organization.id, trigger_id=created.id)
            is None
        )

    def test_scoped_to_organization(self) -> None:
        created = self.create_hourly()
        other_org = self.create_organization()
        assert not delete_scheduled_trigger(organization_id=other_org.id, trigger_id=created.id)
        assert (
            get_scheduled_trigger(organization_id=self.organization.id, trigger_id=created.id)
            == created
        )
