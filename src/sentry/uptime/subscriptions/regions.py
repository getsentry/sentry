from __future__ import annotations

import dataclasses
from collections.abc import Mapping, Sequence

from django.conf import settings

from sentry import options
from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.uptime.models import UptimeSubscriptionRegion


@dataclasses.dataclass(frozen=True)
class UptimeRegionWithMode:
    slug: str
    mode: UptimeSubscriptionRegion.RegionMode = UptimeSubscriptionRegion.RegionMode.ACTIVE


def get_active_regions() -> list[UptimeRegionWithMode]:
    configured_regions: Sequence[UptimeRegionConfig] = settings.UPTIME_REGIONS
    region_mode_override: Mapping[str, str] = options.get("uptime.checker-regions-mode-override")

    return [
        (
            UptimeRegionWithMode(
                c.slug,
                UptimeSubscriptionRegion.RegionMode(
                    region_mode_override.get(c.slug, UptimeSubscriptionRegion.RegionMode.ACTIVE)
                ),
            )
        )
        for c in configured_regions
        if region_mode_override.get(c.slug, UptimeSubscriptionRegion.RegionMode.ACTIVE)
        in [UptimeSubscriptionRegion.RegionMode.ACTIVE, UptimeSubscriptionRegion.RegionMode.SHADOW]
    ]


def get_region_config(region_slug: str) -> UptimeRegionConfig | None:
    return next((r for r in settings.UPTIME_REGIONS if r.slug == region_slug), None)
