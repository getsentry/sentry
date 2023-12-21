from __future__ import annotations

from contextlib import contextmanager
from typing import Sequence

from sentry.types.region import Region, RegionDirectory, load_global_regions


@contextmanager
def override_regions(regions: Sequence[Region], local_region: Region | None = None):
    """Override the global set of existing regions.

    The overriding value takes the place of the `SENTRY_REGION_CONFIG` setting and
    changes the behavior of the module-level functions in `sentry.types.region`. This
    is preferable to overriding the `SENTRY_REGION_CONFIG` setting value directly
    because the region mapping may already be cached.
    """

    monolith_region = regions[0] if regions else None
    replacement = RegionDirectory(regions, monolith_region, local_region)

    with load_global_regions().swap_state(replacement):
        yield


@contextmanager
def in_local_region(region: Region):
    """Override the local region of the simulated region silo.

    The overriding value takes the place of the `SENTRY_REGION` setting and changes
    the behavior of the module-level functions in `sentry.types.region`. This is
    preferable to overriding the `SENTRY_REGION` setting value directly because the
    region mapping may already be cached.
    """

    global_regions = load_global_regions()
    replacement = RegionDirectory(
        regions=global_regions.regions,
        testenv_monolith_region=global_regions.historic_monolith_region,
        testenv_local_region=region,
    )

    with global_regions.swap_state(replacement):
        yield
