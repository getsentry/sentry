import contextlib
from dataclasses import fields
from unittest.mock import MagicMock, patch

from sentry.analytics.event import Event


def assert_event_equal(
    expected_event: Event,
    recorded_event: Event,
    check_uuid: bool = False,
    check_datetime: bool = False,
    exclude_fields: list[str] | None = None,
):
    if type(expected_event) is not type(recorded_event):
        raise AssertionError(
            f"Expected event type {type(expected_event)} but got {type(recorded_event)}"
        )

    assert expected_event.type == recorded_event.type
    for field in fields(expected_event):
        if field.name == "uuid_" and not check_uuid:
            continue
        if field.name == "datetime_" and not check_datetime:
            continue
        if exclude_fields and field.name in exclude_fields:
            continue
        assert getattr(expected_event, field.name) == getattr(recorded_event, field.name)


def assert_analytics_events_recorded(
    mock_record: MagicMock,
    expected_events: list[Event],
    check_uuid: bool = False,
    check_datetime: bool = False,
    exclude_fields: list[str] | None = None,
):
    recorded_events = [call.args[0] for call in mock_record.call_args_list]
    assert len(expected_events) == len(recorded_events)
    for expected_event, recorded_event in zip(expected_events, recorded_events):
        assert_event_equal(
            expected_event, recorded_event, check_uuid, check_datetime, exclude_fields
        )


def get_last_analytics_event(mock_record: MagicMock) -> Event:
    return mock_record.call_args_list[-1].args[0]


def assert_last_analytics_event(
    mock_record: MagicMock,
    expected_event: Event,
    check_uuid: bool = False,
    check_datetime: bool = False,
    exclude_fields: list[str] | None = None,
):
    assert_event_equal(
        expected_event,
        get_last_analytics_event(mock_record),
        check_uuid,
        check_datetime,
        exclude_fields,
    )


def assert_any_analytics_event(
    mock_record: MagicMock,
    expected_event: Event,
    check_uuid: bool = False,
    check_datetime: bool = False,
    exclude_fields: list[str] | None = None,
):
    recorded_events = [call.args[0] for call in mock_record.call_args_list]
    for recorded_event in recorded_events:
        try:
            assert_event_equal(
                expected_event, recorded_event, check_uuid, check_datetime, exclude_fields
            )
            return
        except AssertionError:
            pass

    raise AssertionError(f"Event {expected_event} not found")


@contextlib.contextmanager
def assert_analytics_events(
    expected_events: list[Event],
    check_uuid: bool = False,
    check_datetime: bool = False,
    exclude_fields: list[str] | None = None,
):
    """
    Context manager that allows you to track analytics events recorded during the context.

    with assert_analytics_events([SomeEvent(...)]):
        ...

    # analytics events must have been recorded in the context
    """
    with patch("sentry.analytics.record") as mock_record:
        yield
        assert_analytics_events_recorded(
            mock_record, expected_events, check_uuid, check_datetime, exclude_fields
        )
