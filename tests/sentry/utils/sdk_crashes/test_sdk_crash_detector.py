import pytest

from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


@pytest.mark.parametrize("field_containing_path", ["package", "module", "abs_path", "filename"])
def test_build_sdk_crash_detection_configs(empty_cocoa_config, field_containing_path):

    empty_cocoa_config.sdk_frame_config.path_patterns = {"Sentry**"}

    detector = SDKCrashDetector(empty_cocoa_config)

    frame = {
        field_containing_path: "Sentry",
    }

    assert detector.is_sdk_frame(frame) is True
