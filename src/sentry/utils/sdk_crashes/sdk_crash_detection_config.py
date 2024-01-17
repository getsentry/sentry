from dataclasses import dataclass
from enum import Enum, unique
from typing import Optional, Sequence, Set

import sentry_sdk
from typing_extensions import TypedDict

from sentry import options
from sentry.utils.sdk_crashes.path_replacer import (
    FixedPathReplacer,
    KeepAfterPatternMatchPathReplacer,
    PathReplacer,
)


@dataclass
class SDKFrameConfig:
    function_patterns: Set[str]

    filename_patterns: Set[str]

    path_replacer: PathReplacer


@unique
class SdkName(Enum):
    Cocoa = "cocoa"
    ReactNative = "react-native"


class SDKCrashDetectionConfig(TypedDict):
    """The SDK crash detection configuration per SDK."""

    """The name of the SDK to detect crashes for."""
    sdk_name: SdkName
    """The project to save the detected SDK crashes to"""
    project_id: int
    """The percentage of events to sample. 0.0 = 0%, 0.5 = 50% 1.0 = 100%."""
    sample_rate: float
    """The organization allowlist to detect crashes for. If None, all organizations are allowed."""
    organization_allowlist: Optional[list[int]]


def build_sdk_crash_detection_configs() -> Sequence[SDKCrashDetectionConfig]:
    configs = [
        _build_config(sdk_name=SdkName.Cocoa, has_allowlist=False),
        _build_config(sdk_name=SdkName.ReactNative, has_allowlist=True),
    ]

    return [config for config in configs if config is not None]


def _build_config(sdk_name: SdkName, has_allowlist: bool) -> Optional[SDKCrashDetectionConfig]:
    options_prefix = f"issues.sdk_crash_detection.{sdk_name.value}"

    project_id = options.get(f"{options_prefix}.project_id")
    if not project_id:
        sentry_sdk.capture_message(f"{sdk_name.value} project_id is not set.")
        return None

    sample_rate = options.get(f"{options_prefix}.sample_rate")
    if not sample_rate:
        return None

    organization_allowlist: Optional[list[int]] = None
    if has_allowlist:
        organization_allowlist = options.get(f"{options_prefix}.organization_allowlist")

    return SDKCrashDetectionConfig(
        sdk_name=sdk_name,
        project_id=project_id,
        sample_rate=sample_rate,
        organization_allowlist=organization_allowlist,
    )


@dataclass
class SDKCrashDetectorConfig:
    sdk_names: Sequence[str]

    min_sdk_version: str

    system_library_path_patterns: Set[str]

    sdk_frame_config: SDKFrameConfig

    sdk_crash_ignore_functions_matchers: Set[str]


cocoa_sdk_crash_detector_config = SDKCrashDetectorConfig(
    # Explicitly use an allow list to avoid detecting SDK crashes for SDK names we don't know.
    sdk_names=[
        "sentry.cocoa",
        "sentry.cocoa.capacitor",
        "sentry.cocoa.react-native",
        "sentry.cocoa.dotnet",
        "sentry.cocoa.flutter",
        "sentry.cocoa.kmp",
        "sentry.cocoa.unity",
        "sentry.cocoa.unreal",
    ],
    # Since changing the debug image type to macho (https://github.com/getsentry/sentry-cocoa/pull/2701)
    # released in sentry-cocoa 8.2.0 (https://github.com/getsentry/sentry-cocoa/blob/main/CHANGELOG.md#820),
    # the frames contain the full paths required for detecting system frames in is_system_library_frame.
    # Therefore, we require at least sentry-cocoa 8.2.0.
    min_sdk_version="8.2.0",
    system_library_path_patterns={r"/System/Library/*", r"/usr/lib/*"},
    sdk_frame_config=SDKFrameConfig(
        function_patterns={
            r"*sentrycrash*",
            r"*\[Sentry*",
            r"*(Sentry*)*",  # Objective-C class extension categories
            r"SentryMX*",  # MetricKit Swift classes
        },
        filename_patterns={"Sentry**"},
        path_replacer=FixedPathReplacer(path="Sentry.framework"),
    ),
    # [SentrySDK crash] is a testing function causing a crash.
    # Therefore, we don't want to mark it a as a SDK crash.
    sdk_crash_ignore_functions_matchers={"**SentrySDK crash**"},
)

react_native_sdk_crash_detector_config = SDKCrashDetectorConfig(
    sdk_names=[
        "sentry.javascript.react-native",
    ],
    # 4.0.0 was released in June 2022, see https://github.com/getsentry/sentry-react-native/releases/tag/4.0.0.
    # We require at least sentry-react-native 4.0.0 to only detect SDK crashes for not too old versions.
    min_sdk_version="4.0.0",
    system_library_path_patterns={
        r"*/react-native/Libraries/*",
        r"*/react-native-community/*",
    },
    sdk_frame_config=SDKFrameConfig(
        function_patterns=set(),
        filename_patterns={r"**/sentry-react-native/dist/**"},
        path_replacer=KeepAfterPatternMatchPathReplacer(
            patterns={r"\/sentry-react-native\/.*", r"\/@sentry.*"},
            fallback_path="sentry-react-native",
        ),
    ),
    sdk_crash_ignore_functions_matchers=set(),
)
