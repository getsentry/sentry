import pytest

from sentry.profiles.device import GIB, DeviceClass, classify_device


@pytest.mark.parametrize(
    "device_model,device_os_name,device_is_emulator,device_cpu_frequencies,device_memory,expected",
    [
        ("iPhone14,3", "iOS", False, None, None, DeviceClass.HIGH_END),
        ("iPhone14,3", "iOS", True, None, None, DeviceClass.UNCLASSIFIED),
        ("Pixel 6 Pro", "android", False, None, None, DeviceClass.UNCLASSIFIED),
        ("Pixel 6 Pro", "android", False, [8000] * 8, 8 * GIB, DeviceClass.HIGH_END),
        ("Pixel 6 Pro", "android", True, None, None, DeviceClass.UNCLASSIFIED),
        ("SentryPhone", "SentryOS", False, None, None, DeviceClass.UNCLASSIFIED),
        ("SentryPhone", "SentryOS", True, None, None, DeviceClass.UNCLASSIFIED),
    ],
)
def test_classify_device(
    device_model,
    device_os_name,
    device_is_emulator,
    device_cpu_frequencies,
    device_memory,
    expected,
):
    assert (
        classify_device(
            device_model, device_os_name, device_is_emulator, device_cpu_frequencies, device_memory
        )
        == expected
    )
