from contextlib import contextmanager
from typing import Any, Mapping, Sequence

from django.test.utils import override_settings

from sentry.types import region


@contextmanager
def override_regions(regions: Sequence[region.Region]):
    """Override the global set of existing regions.

    The overriding value takes the place of the `SENTRY_REGION_CONFIG` setting and
    changes the behavior of the module-level functions in `sentry.types.region`. This
    is preferable to overriding the `SENTRY_REGION_CONFIG` setting value directly
    because the region mapping may already be cached.
    """

    @contextmanager
    def fix_monolith_region_pointer():
        # Set SENTRY_MONOLITH_REGION to make GlobalRegionDirectory validation happy.
        # This won't affect the behavior of the Region.is_historic_monolith_region method;
        # tests that rely on it must override SENTRY_MONOLITH_REGION in their own cases.
        if regions:
            with override_settings(SENTRY_MONOLITH_REGION=regions[0].name):
                yield
        else:
            yield

    with fix_monolith_region_pointer():
        mapping = region.GlobalRegionDirectory(regions)

    def override() -> region.GlobalRegionDirectory:
        return mapping

    existing = region.load_global_regions
    region.load_global_regions = override

    try:
        yield
    finally:
        region.load_global_regions = existing


@contextmanager
def override_region_config(region_configs: Sequence[Mapping[str, Any]]):
    region_objs = tuple(region.parse_raw_config(region_configs))
    with override_regions(region_objs):
        yield
