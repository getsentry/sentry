from dataclasses import dataclass
from enum import Enum, unique
from typing import List, Optional, Sequence, Set

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


@dataclass
class SDKCrashDetectionConfig:
    """The SDK crash detection configuration per SDK."""

    """The name of the SDK to detect crashes for."""
    sdk_name: SdkName
    """The project to save the detected SDK crashes to"""
    project_id: int
    """The percentage of events to sample. 0.0 = 0%, 0.5 = 50% 1.0 = 100%."""
    sample_rate: float
    """The organization allowlist to detect crashes for. If None, all organizations are allowed."""
    organization_allowlist: Optional[list[int]]
    """The SDK names to detect crashes for. For example, ["sentry.cocoa", "sentry.cocoa.react-native"]."""
    sdk_names: Sequence[str]
    """The minimum SDK version to detect crashes for. For example, "8.2.0"."""
    min_sdk_version: str
    """The system library path patterns to detect system frames. For example, `System/Library/*` """
    system_library_path_patterns: Set[str]
    """The configuration for detecting SDK frames."""
    sdk_frame_config: SDKFrameConfig
    """The functions to ignore when detecting SDK crashes. For example, `**SentrySDK crash**`"""
    sdk_crash_ignore_functions_matchers: Set[str]


class SDKCrashDetectionOptions(TypedDict):
    project_id: int
    sample_rate: float
    organization_allowlist: Optional[list[int]]


def build_sdk_crash_detection_configs() -> Sequence[SDKCrashDetectionConfig]:
    configs: List[SDKCrashDetectionConfig] = []

    cocoa_options = _get_options(sdk_name=SdkName.Cocoa, has_organization_allowlist=False)

    if cocoa_options:
        cocoa_config = SDKCrashDetectionConfig(
            sdk_name=SdkName.Cocoa,
            project_id=cocoa_options["project_id"],
            sample_rate=cocoa_options["sample_rate"],
            organization_allowlist=cocoa_options["organization_allowlist"],
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
        configs.append(cocoa_config)

    react_native_options = _get_options(
        sdk_name=SdkName.ReactNative, has_organization_allowlist=True
    )
    if react_native_options:
        react_native_config = SDKCrashDetectionConfig(
            sdk_name=SdkName.ReactNative,
            project_id=react_native_options["project_id"],
            sample_rate=react_native_options["sample_rate"],
            organization_allowlist=react_native_options["organization_allowlist"],
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
        configs.append(react_native_config)

    return configs


def _get_options(
    sdk_name: SdkName, has_organization_allowlist: bool
) -> Optional[SDKCrashDetectionOptions]:
    options_prefix = f"issues.sdk_crash_detection.{sdk_name.value}"

    project_id = options.get(f"{options_prefix}.project_id")
    if not project_id:
        sentry_sdk.capture_message(f"{sdk_name.value} project_id is not set.")
        return None

    sample_rate = options.get(f"{options_prefix}.sample_rate")
    if not sample_rate:
        return None

    organization_allowlist: Optional[list[int]] = None
    if has_organization_allowlist:
        organization_allowlist = options.get(f"{options_prefix}.organization_allowlist")

    return SDKCrashDetectionOptions(
        project_id=project_id,
        sample_rate=sample_rate,
        organization_allowlist=organization_allowlist,
    )
