from unittest.mock import Mock

from sentry.utils.sdk_crashes.event_stripper import EventStripper
from tests.sentry.utils.sdk_crashes.test_fixture import get_crash_event


def test_strip_event_data_keeps_allowed_keys():
    event_stripper = EventStripper(Mock())

    stripped_event = event_stripper.strip_event_data(get_crash_event())

    keys_removed = {"tags", "user", "threads", "breadcrumbs", "environment"}
    for key in keys_removed:
        assert stripped_event.get(key) is None

    keys_kept = {
        "type",
        "datetime",
        "timestamp",
        "platform",
        "sdk",
        "level",
        "logger",
        "exception",
        "debug_meta",
        "contexts",
    }

    for key in keys_kept:
        assert stripped_event.get(key) is not None


def test_strip_event_data_strips_context():
    event_stripper = EventStripper(Mock())

    stripped_event = event_stripper.strip_event_data(get_crash_event())

    contexts = stripped_event.get("contexts")
    assert contexts is not None
    assert contexts.get("app") is None
    assert contexts.get("os") is not None
    assert contexts.get("device") is not None
