from enum import Enum, unique
from typing import Optional, Sequence

import sentry_sdk
from typing_extensions import TypedDict

from sentry import options


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
