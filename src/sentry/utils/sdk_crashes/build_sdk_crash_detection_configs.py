from typing import Sequence

import sentry_sdk

from sentry import options
from sentry.utils.sdk_crashes.sdk_crash_detection_config import SDKCrashDetectionConfig, SdkName


def build_sdk_crash_detection_configs() -> Sequence[SDKCrashDetectionConfig]:
    cocoa_project_id = options.get(
        "issues.sdk_crash_detection.cocoa.project_id",
    )
    if not cocoa_project_id or cocoa_project_id == 0:
        sentry_sdk.capture_message("Cocoa project_id is not set.")
        return []

    cocoa_sample_rate = options.get("issues.sdk_crash_detection.cocoa.sample_rate")
    # When the sample rate is 0, we can skip the sdk crash detection.
    if not cocoa_sample_rate or cocoa_sample_rate == 0:
        return []

    cocoa_config = SDKCrashDetectionConfig(
        sdk_name=SdkName.Cocoa, project_id=cocoa_project_id, sample_rate=cocoa_sample_rate
    )

    return [cocoa_config]
