from contextlib import contextmanager
from typing import Iterable

from sentry.types import region


@contextmanager
def override_regions(regions: Iterable[region.Region]):
    """Override the global set of existing regions.

    The overriding value takes the place of the `SENTRY_REGION_CONFIG` setting and
    changes the behavior of the module-level functions in `sentry.types.region`. This
    is preferable to overriding the `SENTRY_REGION_CONFIG` setting value directly
    because the region mapping may already be cached.
    """

    mapping = region.GlobalRegionDirectory(list(regions))

    def override() -> region.GlobalRegionDirectory:
        return mapping

    existing = region.load_global_regions
    region.load_global_regions = override

    try:
        yield
    finally:
        region.load_global_regions = existing
