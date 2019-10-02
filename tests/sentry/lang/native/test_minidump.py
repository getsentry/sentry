from __future__ import absolute_import
import io
import msgpack
from sentry.lang.native.minidump import (
    is_minidump_event,
    merge_attached_breadcrumbs,
    merge_attached_event,
)


class MockFile(object):
    def __init__(self, bytes):
        self._io = io.BytesIO(bytes)
        self.size = len(bytes)

    def __getattr__(self, name):
        return getattr(self._io, name)


def test_merge_attached_event_empty():
    mpack_event = msgpack.packb({})
    event = {}
    merge_attached_event(MockFile(mpack_event), event)
    assert not event


def test_merge_attached_event_too_large_empty():
    mpack_event = msgpack.packb({"a": "a" * 100000})
    event = {}
    merge_attached_event(MockFile(mpack_event), event)
    assert not event


def test_merge_attached_event_arbitrary_key():
    mpack_event = msgpack.packb({"key": "value"})
    event = {}
    merge_attached_event(MockFile(mpack_event), event)
    assert event["key"] == "value"


def test_merge_attached_event_empty_file():
    event = {}
    merge_attached_event(MockFile(b""), event)
    assert not event


def test_merge_attached_event_invalid_file():
    event = {}
    merge_attached_event(MockFile(b"\xde"), event)
    assert not event


def test_merge_attached_breadcrumbs_empty_creates_crumb():
    mpack_crumb = msgpack.packb({})
    event = {}
    merge_attached_breadcrumbs(MockFile(mpack_crumb), event)
    assert event


def test_merge_attached_breadcrumb_too_large_empty():
    mpack_crumb = msgpack.packb({"message": "a" * 50000})
    event = {}
    merge_attached_breadcrumbs(MockFile(mpack_crumb), event)
    assert not event.get("breadcrumbs")


def test_merge_attached_breadcrumbs_empty_file():
    event = {}
    merge_attached_breadcrumbs(MockFile(b""), event)
    assert not event.get("breadcrumbs")


def test_merge_attached_breadcrumbs_invalid_file():
    event = {}
    merge_attached_breadcrumbs(MockFile(b"\xde"), event)
    assert not event.get("breadcrumbs")


# See:
# https://github.com/getsentry/sentrypad/blob/e1d4feb65c3e9db829cc4ca9d4003ff3c818d95a/src/sentry.cpp#L337-L366
def test_merge_attached_breadcrumbs_single_crumb():
    mpack_crumb = msgpack.packb(
        {
            "timestamp": "0000-00-00T00:00:00Z",
            "category": "c",
            "type": "t",
            "level": "debug",
            "message": "m",
        }
    )
    event = {}
    merge_attached_breadcrumbs(MockFile(mpack_crumb), event)
    assert event["breadcrumbs"][0]["timestamp"] == "0000-00-00T00:00:00Z"
    assert event["breadcrumbs"][0]["category"] == "c"
    assert event["breadcrumbs"][0]["type"] == "t"
    assert event["breadcrumbs"][0]["level"] == "debug"
    assert event["breadcrumbs"][0]["message"] == "m"


def test_merge_attached_breadcrumbs_timestamp_ordered():
    event = {}
    mpack_crumb1 = msgpack.packb({"timestamp": "0001-01-01T01:00:02Z"})
    merge_attached_breadcrumbs(MockFile(mpack_crumb1), event)
    assert event["breadcrumbs"][0]["timestamp"] == "0001-01-01T01:00:02Z"

    crumbs_file2 = bytearray()
    crumbs_file2.extend(msgpack.packb({"timestamp": "0001-01-01T01:00:01Z"}))
    # File with 2 items to extend cap
    crumbs_file2.extend(msgpack.packb({"timestamp": "0001-01-01T01:00:01Z"}))
    merge_attached_breadcrumbs(MockFile(crumbs_file2), event)
    assert event["breadcrumbs"][0]["timestamp"] == "0001-01-01T01:00:01Z"
    assert event["breadcrumbs"][1]["timestamp"] == "0001-01-01T01:00:02Z"

    mpack_crumb3 = msgpack.packb({"timestamp": "0001-01-01T01:00:03Z"})
    merge_attached_breadcrumbs(MockFile(mpack_crumb3), event)
    assert event["breadcrumbs"][0]["timestamp"] == "0001-01-01T01:00:02Z"
    assert event["breadcrumbs"][1]["timestamp"] == "0001-01-01T01:00:03Z"

    mpack_crumb4 = msgpack.packb({"timestamp": "0001-01-01T01:00:00Z"})
    merge_attached_breadcrumbs(MockFile(mpack_crumb4), event)
    assert event["breadcrumbs"][0]["timestamp"] == "0001-01-01T01:00:02Z"
    assert event["breadcrumbs"][1]["timestamp"] == "0001-01-01T01:00:03Z"


def test_merge_attached_breadcrumbs_capped():
    # Crumbs are capped by the largest file
    event = {}

    crumbs_file1 = bytearray()
    for i in range(0, 2):
        crumbs_file1.extend(msgpack.packb({"timestamp": "0001-01-01T01:00:01Z"}))

    merge_attached_breadcrumbs(MockFile(crumbs_file1), event)
    assert len(event["breadcrumbs"]) == 2
    assert event["breadcrumbs"][0]["timestamp"] == "0001-01-01T01:00:01Z"
    assert event["breadcrumbs"][1]["timestamp"] == "0001-01-01T01:00:01Z"

    crumbs_file2 = bytearray()
    for i in range(0, 3):
        crumbs_file2.extend(msgpack.packb({"timestamp": "0001-01-01T01:00:02Z"}))

    merge_attached_breadcrumbs(MockFile(crumbs_file2), event)
    assert len(event["breadcrumbs"]) == 3
    assert event["breadcrumbs"][0]["timestamp"] == "0001-01-01T01:00:02Z"
    assert event["breadcrumbs"][1]["timestamp"] == "0001-01-01T01:00:02Z"
    assert event["breadcrumbs"][2]["timestamp"] == "0001-01-01T01:00:02Z"

    crumbs_file3 = msgpack.packb({"timestamp": "0001-01-01T01:00:03Z"})
    merge_attached_breadcrumbs(MockFile(crumbs_file3), event)
    assert len(event["breadcrumbs"]) == 3
    assert event["breadcrumbs"][0]["timestamp"] == "0001-01-01T01:00:02Z"
    assert event["breadcrumbs"][1]["timestamp"] == "0001-01-01T01:00:02Z"
    assert event["breadcrumbs"][2]["timestamp"] == "0001-01-01T01:00:03Z"

    crumbs_file4 = msgpack.packb({"timestamp": "0001-01-01T01:00:04Z"})
    merge_attached_breadcrumbs(MockFile(crumbs_file4), event)
    assert len(event["breadcrumbs"]) == 3
    assert event["breadcrumbs"][0]["timestamp"] == "0001-01-01T01:00:02Z"
    assert event["breadcrumbs"][1]["timestamp"] == "0001-01-01T01:00:03Z"
    assert event["breadcrumbs"][2]["timestamp"] == "0001-01-01T01:00:04Z"


def test_is_minidump():
    assert is_minidump_event({"exception": {"values": [{"mechanism": {"type": "minidump"}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": {"type": "other"}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": {"type": None}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": None}]}})
    assert not is_minidump_event({"exception": {"values": [None]}})
    assert not is_minidump_event({"exception": {"values": []}})
    assert not is_minidump_event({"exception": {"values": None}})
    assert not is_minidump_event({"exception": None})
