from django.conf import settings

from sentry.conf.types.uptime import UptimeRegionConfig


def get_active_region_configs() -> list[UptimeRegionConfig]:
    return [v for v in settings.UPTIME_REGIONS if v.enabled]


def get_region_config(region_slug: str) -> UptimeRegionConfig | None:
    region = next((r for r in settings.UPTIME_REGIONS if r.slug == region_slug), None)
    if region is None:
        # XXX: Temporary hack to guarantee we get a config
        region = get_active_region_configs()[0]
    return region
