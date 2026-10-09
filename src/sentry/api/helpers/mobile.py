from __future__ import annotations


def get_readable_device_name(device: str) -> str | None:
    # Imported here so web workers do not hold the 24k-entry Android table at boot. Only
    # the device tag lookups read it.
    from sentry.api.helpers.android_models import ANDROID_MODELS
    from sentry.api.helpers.ios_models import IOS_MODELS

    if device in IOS_MODELS:
        return IOS_MODELS[device]
    if device in ANDROID_MODELS:
        return ANDROID_MODELS[device]
    return None
