from dataclasses import fields
from unittest.mock import MagicMock

from sentry.analytics.event import Event


def assert_event_equal(
    expected_event: Event,
    recorded_event: Event,
    check_uuid: bool = False,
    check_datetime: bool = False,
):
    assert expected_event.type == recorded_event.type
    for field in fields(expected_event):
        if field.name == "uuid_" and not check_uuid:
            continue
        if field.name == "datetime_" and not check_datetime:
            continue
        assert getattr(expected_event, field.name) == getattr(recorded_event, field.name)


def assert_analytics_events_recorded(
    mock_record: MagicMock,
    expected_events: list[Event],
    check_uuid: bool = False,
    check_datetime: bool = False,
):
    recorded_events = [call.args[0] for call in mock_record.call_args_list]
    assert len(expected_events) == len(recorded_events)
    for expected_event, recorded_event in zip(expected_events, recorded_events):
        assert_event_equal(expected_event, recorded_event, check_uuid, check_datetime)
