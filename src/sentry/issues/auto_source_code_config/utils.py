from sentry import options

from .constants import PLATFORMS_CONFIG


def supported_platform(platform: str) -> bool:
    """Return True if the platform is supported"""
    return platform in PLATFORMS_CONFIG


# This is used by repo_trees.py to determine which files to keep in the cache
def get_supported_extensions() -> list[str]:
    """Return a list of all supported extensions across all languages"""
    extensions: set[str] = set()
    for config in PLATFORMS_CONFIG.values():
        extensions.update(config["extensions"])
    return list(extensions)


def is_dry_run_platform(platform: str) -> bool:
    return platform in options.get("issues.auto_source_code_config.dry-run-platforms")


class PlatformConfig:
    def __init__(self, platform: str) -> None:
        self.platform = platform
        self.config = PLATFORMS_CONFIG[platform]

    def is_supported(self) -> bool:
        return self.config is not None

    def is_dry_run_platform(self) -> bool:
        dry_run_platforms = options.get("issues.auto_source_code_config.dry-run-platforms", [])
        return self.platform in dry_run_platforms

    def extracts_filename_from_module(self) -> bool:
        return self.config.get("extract_filename_from_module", False)

    def creates_in_app_stack_trace_rules(self) -> bool:
        return self.config.get("create_in_app_stack_trace_rules", False)
