from __future__ import absolute_import
import io
import msgpack
from sentry.lang.native.minidump import (
    is_minidump_event,
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


def test_is_minidump():
    assert is_minidump_event({"exception": {"values": [{"mechanism": {"type": "minidump"}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": {"type": "other"}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": {"type": None}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": None}]}})
    assert not is_minidump_event({"exception": {"values": [None]}})
    assert not is_minidump_event({"exception": {"values": []}})
    assert not is_minidump_event({"exception": {"values": None}})
    assert not is_minidump_event({"exception": None})
