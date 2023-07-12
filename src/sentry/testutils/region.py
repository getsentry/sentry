from contextlib import contextmanager
from typing import Iterable

from django.test.utils import override_settings

from sentry.types import region


@contextmanager
def override_regions(regions: Iterable[region.Region]):
    """Override the global set of existing regions.

    The overriding value takes the place of the `SENTRY_REGION_CONFIG` setting and
    changes the behavior of the module-level functions in `sentry.types.region`. This
    is preferable to overriding the `SENTRY_REGION_CONFIG` setting value directly
    because the region mapping may already be cached.
    """

    regions = list(regions)

    # Set SENTRY_MONOLITH_REGION to make GlobalRegionDirectory validation happy.
    # This won't affect the behavior of the Region.is_historic_monolith_region method;
    # tests that rely on it must override SENTRY_MONOLITH_REGION in their own cases.
    with override_settings(SENTRY_MONOLITH_REGION=regions[0].name):
        mapping = region.GlobalRegionDirectory(regions)

    def override() -> region.GlobalRegionDirectory:
        return mapping

    existing = region.load_global_regions
    region.load_global_regions = override

    try:
        yield
    finally:
        region.load_global_regions = existing
