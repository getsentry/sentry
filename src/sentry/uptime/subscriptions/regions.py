from django.conf import settings

from sentry.conf.types.uptime import UptimeRegionConfig

region_lookup = None


def get_active_region_configs() -> list[UptimeRegionConfig]:
    return [v for v in settings.UPTIME_REGIONS if v.enabled]


def get_region_config(region_slug: str) -> UptimeRegionConfig | None:
    region = get_region_lookup().get(region_slug)
    if region is None:
        # XXX: Temporary hack to guarantee we get a config
        region = get_active_region_configs()[0]
    return region


def get_region_lookup() -> dict[str, UptimeRegionConfig]:
    global region_lookup
    if region_lookup is None:
        region_lookup = {r.slug: r for r in settings.UPTIME_REGIONS}
    return region_lookup
