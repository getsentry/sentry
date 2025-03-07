from typing import Any

from .constants import PLATFORMS_CONFIG


def supported_platform(platform: str) -> bool:
    """Return True if the platform is supported"""
    return platform in PLATFORMS_CONFIG


def get_supported_platforms() -> list[str]:
    """Return a list of all supported platforms"""
    return list(PLATFORMS_CONFIG.keys())


# This is used by repo_trees.py to determine which files to keep in the cache
def get_supported_extensions() -> list[str]:
    """Return a list of all supported extensions across all languages"""
    extensions: set[str] = set()
    for config in PLATFORMS_CONFIG.values():
        extensions.update(config["extensions"])
    return list(extensions)


def get_platform_config(platform: str) -> dict[str, Any]:
    """Return the platform config for the given platform"""
    return dict(PLATFORMS_CONFIG[platform])


class PlatformConfig:
    def __init__(self, platform: str) -> None:
        self.platform = platform
        self.config = get_platform_config(platform)

    def is_supported(self) -> bool:
        return self.config is not None

    def is_dry_run_platform(self) -> bool:
        return self.config.get("dry_run", False)

    def extracts_filename_from_module(self) -> bool:
        return self.config.get("extract_filename_from_module", False)

    def creates_in_app_stack_trace_rules(self) -> bool:
        return self.config.get("create_in_app_stack_trace_rules", False)
