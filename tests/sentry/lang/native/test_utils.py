from __future__ import absolute_import

from sentry.lang.native.utils import get_sdk_from_event, is_minidump_event


def test_get_sdk_from_event():
    sdk_info = get_sdk_from_event(
        {
            "debug_meta": {
                "sdk_info": {
                    "sdk_name": "iOS",
                    "version_major": 9,
                    "version_minor": 3,
                    "version_patchlevel": 0,
                }
            }
        }
    )
    assert sdk_info["sdk_name"] == "iOS"
    assert sdk_info["version_major"] == 9
    assert sdk_info["version_minor"] == 3
    assert sdk_info["version_patchlevel"] == 0

    sdk_info = get_sdk_from_event(
        {"contexts": {"os": {"type": "os", "name": "iOS", "version": "9.3.1.1234"}}}
    )

    assert sdk_info["sdk_name"] == "iOS"
    assert sdk_info["version_major"] == 9
    assert sdk_info["version_minor"] == 3
    assert sdk_info["version_patchlevel"] == 1


def test_is_minidump():
    assert is_minidump_event({"exception": {"values": [{"mechanism": {"type": "minidump"}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": {"type": "other"}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": {"type": None}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": None}]}})
    assert not is_minidump_event({"exception": {"values": [None]}})
    assert not is_minidump_event({"exception": {"values": []}})
    assert not is_minidump_event({"exception": {"values": None}})
    assert not is_minidump_event({"exception": None})
