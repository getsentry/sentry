import pytest

from sentry.utils.sdk_crashes.path_replacer import FixedPathReplacer
from sentry.utils.sdk_crashes.sdk_crash_detection_config import (
    SDKCrashDetectionConfig,
    SDKFrameConfig,
    SdkName,
)


@pytest.fixture
def store_event(default_project, factories):
    def inner(data):
        return factories.store_event(data=data, project_id=default_project.id)

    return inner


@pytest.fixture
def empty_cocoa_config() -> SDKCrashDetectionConfig:
    return SDKCrashDetectionConfig(
        sdk_name=SdkName.Cocoa,
        project_id=0,
        sample_rate=0.0,
        organization_allowlist=[],
        sdk_names=[],
        min_sdk_version="",
        system_library_path_patterns=set(),
        sdk_frame_config=SDKFrameConfig(
            function_patterns=set(),
            path_patterns=set(),
            path_replacer=FixedPathReplacer(path=""),
        ),
        sdk_crash_ignore_functions_matchers=set(),
    )
