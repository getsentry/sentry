from unittest.mock import MagicMock, patch

import pytest

from sentry.lang.native.utils import (
    Backoff,
    _uid_from_nvdbg_filename,
    get_os_from_event,
    is_gpu_crash_event,
    is_minidump_event,
)


def test_get_os_from_event() -> None:
    os = get_os_from_event(
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
    assert os == "ios"

    os = get_os_from_event(
        {"contexts": {"os": {"type": "os", "name": "iOS", "version": "9.3.1.1234"}}}
    )
    assert os == "ios"


def test_is_minidump() -> None:
    assert is_minidump_event({"exception": {"values": [{"mechanism": {"type": "minidump"}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": {"type": "other"}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": {"type": None}}]}})
    assert not is_minidump_event({"exception": {"values": [{"mechanism": None}]}})
    assert not is_minidump_event({"exception": {"values": [None]}})
    assert not is_minidump_event({"exception": {"values": []}})
    assert not is_minidump_event({"exception": {"values": None}})
    assert not is_minidump_event({"exception": None})


@pytest.mark.parametrize(
    "filename,expected",
    [
        # Production SDKs ship the full 32-hex uid.
        ("59339c1ea893474000000210749de540.nvdbg", "59339c1ea893474000000210749de540"),
        # The NVIDIA D3D12HelloNsightAftermath sample splits id[0]/id[1] with a
        # dash — the two 16-hex halves concatenate back to the 32-hex uid.
        (
            "shader-59339c1ea8934740-00000210749de540.nvdbg",
            "59339c1ea893474000000210749de540",
        ),
        # Uppercase is normalized to lowercase to match the decoder's key.
        ("ABCDEF0123456789ABCDEF0123456789.nvdbg", "abcdef0123456789abcdef0123456789"),
        # No parseable uid => None (skipped by the finders).
        ("garbage.txt", None),
        ("shader-nope.nvdbg", None),
    ],
)
def test_uid_from_nvdbg_filename(filename: str, expected: str | None) -> None:
    assert _uid_from_nvdbg_filename(filename) == expected


class _Att:
    def __init__(self, type: str, name: str = "") -> None:
        self.type = type
        self.name = name


@pytest.mark.parametrize(
    "attachments,expected",
    [
        # A pure GPU event (dump, no CPU crash report) — Relay split it off → teapot.
        ([_Att("event.nv_gpudmp", "d.nv-gpudmp")], True),
        # A combined upload (dump + minidump) is the CPU crash → leave it to symbolicator.
        ([_Att("event.nv_gpudmp", "d.nv-gpudmp"), _Att("event.minidump", "m")], False),
        # Same for an apple crash report (dump matched via the filename fallback).
        ([_Att("event.attachment", "d.nv-gpudmp"), _Att("event.applecrashreport", "a")], False),
        # No GPU dump at all.
        ([_Att("event.attachment", "log.txt")], False),
    ],
)
def test_is_gpu_crash_event(attachments: list[_Att], expected: bool) -> None:
    with patch("sentry.lang.native.utils.get_attachments_for_event", return_value=attachments):
        assert is_gpu_crash_event({}) is expected


@patch("time.sleep")
def test_backoff(mock_sleep: MagicMock) -> None:
    backoff = Backoff(0.1, 5)

    for _ in range(3):
        backoff.reset()
        mock_sleep.assert_not_called()

        backoff.sleep_failure()  # 0 second sleep
        mock_sleep.assert_not_called()

        backoff.sleep_failure()
        mock_sleep.assert_called_with(0.1)
        backoff.sleep_failure()
        mock_sleep.assert_called_with(0.2)
        backoff.sleep_failure()
        mock_sleep.assert_called_with(0.4)
        backoff.sleep_failure()
        mock_sleep.assert_called_with(0.8)
        backoff.sleep_failure()
        mock_sleep.assert_called_with(1.6)
        backoff.sleep_failure()
        mock_sleep.assert_called_with(3.2)
        backoff.sleep_failure()
        mock_sleep.assert_called_with(5)
        backoff.sleep_failure()
        mock_sleep.assert_called_with(5)
        mock_sleep.reset_mock()
