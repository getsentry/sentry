from .constants import DRY_RUN_PLATFORMS, SUPPORTED_LANGUAGES


def supported_platform(platform: str | None = None) -> bool:
    return platform in SUPPORTED_LANGUAGES + DRY_RUN_PLATFORMS
