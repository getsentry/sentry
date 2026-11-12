from collections.abc import Generator
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest

from sentry.cadence.models import ScheduledTriggerType
from sentry.cadence.registry import TriggerHandler, trigger_type_registry
from sentry.cadence.spread import fire_offset, spread_window_for
from sentry.utils.registry import NoRegistrationExistsError

SEER_WORKFLOW = ScheduledTriggerType.SEER_WORKFLOW
DAILY = timedelta(days=1)


@pytest.fixture(autouse=True)
def empty_registry() -> Generator[None]:
    with patch.dict(trigger_type_registry.registrations, clear=True):
        yield


def register(spread_window: timedelta) -> None:
    trigger_type_registry.registrations[SEER_WORKFLOW] = MagicMock(
        spec=TriggerHandler, spread_window=spread_window
    )


def offsets(min_gap: timedelta, count: int = 200) -> list[timedelta]:
    return [
        fire_offset(
            organization_id=1, trigger_type=SEER_WORKFLOW, target_id=target_id, min_gap=min_gap
        )
        for target_id in range(count)
    ]


def test_spread_window_is_at_most_half_the_gap() -> None:
    register(timedelta(hours=1))

    assert spread_window_for(SEER_WORKFLOW, DAILY) == timedelta(hours=1)
    assert spread_window_for(SEER_WORKFLOW, timedelta(hours=2)) == timedelta(hours=1)
    assert spread_window_for(SEER_WORKFLOW, timedelta(minutes=30)) == timedelta(minutes=15)


def test_fire_offset_is_zero_without_spread_window() -> None:
    register(timedelta(0))

    assert set(offsets(DAILY)) == {timedelta(0)}


def test_daily_runs_spread_over_the_whole_window() -> None:
    window = timedelta(hours=1)
    register(window)

    daily = offsets(DAILY)

    assert daily == offsets(DAILY)
    assert all(timedelta(0) <= offset < window for offset in daily)
    assert all(offset % timedelta(seconds=1) == timedelta(0) for offset in daily)
    # Spread across the hour, not clustered.
    assert max(daily) > timedelta(minutes=50)
    assert len(set(daily)) > 190


def test_frequent_runs_spread_over_half_their_gap() -> None:
    register(timedelta(hours=1))

    frequent = offsets(timedelta(minutes=30))

    assert all(timedelta(0) <= offset < timedelta(minutes=15) for offset in frequent)


def test_fire_offset_depends_on_schedule_identity() -> None:
    register(timedelta(minutes=10))

    base = fire_offset(organization_id=1, trigger_type=SEER_WORKFLOW, target_id=7, min_gap=DAILY)
    by_org = [
        fire_offset(organization_id=org_id, trigger_type=SEER_WORKFLOW, target_id=7, min_gap=DAILY)
        for org_id in range(2, 12)
    ]

    assert any(offset != base for offset in by_org)


def test_fire_offset_of_unregistered_trigger_type_raises() -> None:
    with pytest.raises(NoRegistrationExistsError):
        fire_offset(organization_id=1, trigger_type=SEER_WORKFLOW, target_id=7, min_gap=DAILY)


def test_fire_offset_of_unknown_trigger_type_raises() -> None:
    with pytest.raises(ValueError):
        fire_offset(organization_id=1, trigger_type="removed_type", target_id=7, min_gap=DAILY)
