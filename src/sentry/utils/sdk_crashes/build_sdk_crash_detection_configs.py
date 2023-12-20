from typing import Optional, Sequence

import sentry_sdk

from sentry import options
from sentry.utils.sdk_crashes.sdk_crash_detection_config import SDKCrashDetectionConfig, SdkName


def build_sdk_crash_detection_configs() -> Sequence[SDKCrashDetectionConfig]:
    configs = [_build_config(SdkName.Cocoa), _build_config(SdkName.ReactNative)]

    return [config for config in configs if config is not None]


def _build_config(sdk_name: SdkName) -> Optional[SDKCrashDetectionConfig]:
    options_prefix = f"issues.sdk_crash_detection.{sdk_name.value}"

    project_id = options.get(f"{options_prefix}.project_id")
    if not project_id:
        sentry_sdk.capture_message(f"{sdk_name.value} project_id is not set.")
        return None

    sample_rate = options.get(f"{options_prefix}.sample_rate")
    if not sample_rate:
        return None

    return SDKCrashDetectionConfig(
        sdk_name=sdk_name, project_id=project_id, sample_rate=sample_rate
    )
