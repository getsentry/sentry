from typing import int
import contextlib
from collections.abc import Generator
from dataclasses import fields
from unittest.mock import MagicMock, patch

from sentry.analytics.event import Event


def get_last_analytics_event(mock_record: MagicMock) -> Event:
    return mock_record.call_args_list[-1].args[0]


def get_all_analytics_events(mock_record: MagicMock) -> list[Event]:
    return [call.args[0] for call in mock_record.call_args_list]


def assert_event_equal(
    expected_event: Event,
    recorded_event: Event,
    exclude_fields: list[str] | None = None,
) -> None:
    if type(expected_event) is not type(recorded_event):
        raise AssertionError(
            f"Expected event type {type(expected_event)} but got {type(recorded_event)}"
        )

    assert expected_event.type == recorded_event.type
    for field in fields(expected_event):
        if exclude_fields and field.name in exclude_fields:
            continue
        assert getattr(expected_event, field.name) == getattr(recorded_event, field.name)


def assert_analytics_events_recorded(
    mock_record: MagicMock,
    expected_events: list[Event],
    exclude_fields: list[str] | None = None,
) -> None:
    recorded_events = get_all_analytics_events(mock_record)
    assert len(expected_events) == len(recorded_events)
    for expected_event, recorded_event in zip(expected_events, recorded_events):
        assert_event_equal(expected_event, recorded_event, exclude_fields)


def assert_last_analytics_event(
    mock_record: MagicMock,
    expected_event: Event,
    exclude_fields: list[str] | None = None,
) -> None:
    assert_event_equal(
        expected_event,
        get_last_analytics_event(mock_record),
        exclude_fields,
    )


def assert_any_analytics_event(
    mock_record: MagicMock,
    expected_event: Event,
    exclude_fields: list[str] | None = None,
) -> None:
    recorded_events = get_all_analytics_events(mock_record)
    for recorded_event in recorded_events:
        try:
            assert_event_equal(expected_event, recorded_event, exclude_fields)
            return
        except AssertionError:
            pass

    raise AssertionError(f"Event {expected_event} not found")


def assert_not_analytics_event(
    mock_record: MagicMock,
    watched_event: Event | type[Event],
    exclude_fields: list[str] | None = None,
) -> None:
    """Assert that an analytics event (either specific instance or type) was not recorded"""
    recorded_events = get_all_analytics_events(mock_record)
    for recorded_event in recorded_events:
        if isinstance(watched_event, type):
            if isinstance(recorded_event, watched_event):
                raise AssertionError(f"Event {recorded_event} should not have been recorded")
        else:
            try:
                assert_event_equal(watched_event, recorded_event, exclude_fields)
            except AssertionError:
                pass
            else:
                raise AssertionError(f"Event {recorded_event} should not have been recorded")


@contextlib.contextmanager
def assert_analytics_events(
    expected_events: list[Event],
    exclude_fields: list[str] | None = None,
) -> Generator[None]:
    """
    Context manager that allows you to track analytics events recorded during the context.

    with assert_analytics_events([SomeEvent(...)]):
        ...

    # analytics events must have been recorded in the context
    """
    with patch("sentry.analytics.record") as mock_record:
        yield
        assert_analytics_events_recorded(mock_record, expected_events, exclude_fields)


def get_event_count(
    mock_record: MagicMock,
    expected_event_type: type[Event],
    exact: bool = False,
) -> int:
    """
    Get the number of events recorded for a given event type.
    If exact is True, only events of the exact type will be counted.
    If exact is False, events of the exact type or a subclass will be counted.
    """
    if exact:
        return len(
            [
                call
                for call in mock_record.call_args_list
                if type(call.args[0]) is expected_event_type
            ]
        )
    else:
        return len(
            [
                call
                for call in mock_record.call_args_list
                if isinstance(call.args[0], expected_event_type)
            ]
        )
