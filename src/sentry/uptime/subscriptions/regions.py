from collections.abc import Mapping, Sequence

from django.conf import settings

from sentry import options
from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.uptime.models import UptimeSubscriptionRegion


def get_active_region_configs() -> list[UptimeRegionConfig]:
    configured_regions: Sequence[UptimeRegionConfig] = settings.UPTIME_REGIONS
    region_mode_override: Mapping[str] = options.get("uptime.checker-regions-mode-override")

    return [
        c
        for c in configured_regions
        if region_mode_override.get(c.slug, UptimeSubscriptionRegion.RegionMode.ACTIVE)
        == UptimeSubscriptionRegion.RegionMode.ACTIVE
    ]


def get_region_config(region_slug: str) -> UptimeRegionConfig | None:
    return next((r for r in settings.UPTIME_REGIONS if r.slug == region_slug), None)
