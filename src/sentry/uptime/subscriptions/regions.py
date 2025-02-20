from collections.abc import Sequence

from django.conf import settings

from sentry import options
from sentry.conf.types.uptime import UptimeRegionConfig


def get_active_region_configs() -> list[UptimeRegionConfig]:
    configured_regions: Sequence[UptimeRegionConfig] = settings.UPTIME_REGIONS
    disabled_region_slugs: Sequence[str] = options.get("uptime.disabled-checker-regions")

    return [c for c in configured_regions if c.slug not in disabled_region_slugs]


def get_region_config(region_slug: str) -> UptimeRegionConfig | None:
    return next((r for r in settings.UPTIME_REGIONS if r.slug == region_slug), None)
