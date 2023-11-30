from contextlib import contextmanager
from typing import Any, Mapping, Sequence

from sentry.types import region


@contextmanager
def override_regions(regions: Sequence[region.Region]):
    """Override the global set of existing regions.

    The overriding value takes the place of the `SENTRY_REGION_CONFIG` setting and
    changes the behavior of the module-level functions in `sentry.types.region`. This
    is preferable to overriding the `SENTRY_REGION_CONFIG` setting value directly
    because the region mapping may already be cached.
    """

    monolith_region = regions[0].name if regions else None
    replacement = region.RegionDirectory(regions, monolith_region)

    with region.load_global_regions().override(replacement):
        yield


@contextmanager
def override_region_config(region_configs: Sequence[Mapping[str, Any]]):
    region_objs = tuple(region.parse_raw_config(region_configs))
    with override_regions(region_objs):
        yield
