from sentry import options

from .constants import SUPPORTED_LANGUAGES


def supported_platform(platform: str | None = None) -> bool:
    return platform in SUPPORTED_LANGUAGES + dry_run_platforms()


def dry_run_platforms() -> list[str]:
    return options.get("issues.auto_source_code_config.dry-run-platforms")


def is_dry_run_platform(platform: str | None = None) -> bool:
    return platform in dry_run_platforms()
