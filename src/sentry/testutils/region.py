from contextlib import contextmanager
from typing import Iterable
from unittest import mock

from sentry.types.region import Region, _RegionMapping


@contextmanager
def override_regions(regions: Iterable[Region]):
    """Override the global set of existing regions.

    The overriding value takes the place of the `SENTRY_REGION_CONFIG` setting and
    changes the behavior of the module-level functions in `sentry.types.region`. This
    is preferable to overriding the `SENTRY_REGION_CONFIG` setting value directly
    because the region mapping may already be cached.
    """

    mapping = _RegionMapping(regions)

    def override() -> _RegionMapping:
        return mapping

    with mock.patch("sentry.types.region._load_global_regions", new=override):
        yield
