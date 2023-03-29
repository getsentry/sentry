from unittest.mock import Mock

import pytest

from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.cocoa_sdk_crash_detector import CocoaSDKCrashDetector
from sentry.utils.sdk_crashes.event_stripper import EventStripper
from tests.sentry.utils.sdk_crashes.test_fixture import (
    IN_APP_FRAME,
    get_crash_event,
    get_crash_event_with_frames,
    get_frames,
)


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


@pytest.mark.parametrize(
    "function,in_app",
    [
        ("SentryCrashMonitor_CPPException.cpp", True),
        ("SentryCrashMonitor_CPPException.cpp", False),
    ],
    ids=["sentry_in_app_frame_kept", "sentry_not_in_app_frame_kept"],
)
def test_strip_frames(function, in_app):
    event_stripper = EventStripper(CocoaSDKCrashDetector())

    frames = get_frames(function, sentry_frame_in_app=in_app)
    event = get_crash_event_with_frames(frames)

    stripped_event = event_stripper.strip_event_data(event)

    stripped_frames = get_path(stripped_event, "exception", "values", -1, "stacktrace", "frames")

    assert len(stripped_frames) == 6
    assert (
        len([frame for frame in stripped_frames if frame["function"] == IN_APP_FRAME["function"]])
        == 0
    ), "in_app frame should be removed"


def test_strip_event_data_strips_non_referenced_dsyms():
    event_stripper = EventStripper(Mock())

    stripped_event = event_stripper.strip_event_data(get_crash_event())

    debug_meta_images = get_path(stripped_event, "debug_meta", "images")

    image_addresses = set(map(lambda image: image["image_addr"], debug_meta_images))
    expected_image_addresses = {"0x1025e8000", "0x102b8c000", "0x102f68000", "0x19c9eb000"}
    assert image_addresses == expected_image_addresses
