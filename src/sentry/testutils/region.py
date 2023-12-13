from __future__ import annotations

from contextlib import contextmanager
from typing import Collection, Sequence

from sentry.types.region import Region, RegionDirectory, get_global_directory


class TestEnvRegionDirectory(RegionDirectory):
    def __init__(self, regions: Collection[Region], local_region: Region | None) -> None:
        super().__init__(regions, local_region)
        self._tmp_regions: frozenset[Region] | None = None
        self._tmp_local_region: Region | None = None

    @contextmanager
    def swap_state(
        self,
        regions: Sequence[Region] | None = None,
        local_region: Region | None = None,
    ):
        new_regions = self.regions if regions is None else frozenset(regions)
        new_local_region = local_region or (None if self.local_region is None else regions[0])

        old_regions = self._tmp_regions
        old_local_region = self._tmp_local_region
        try:
            self._tmp_regions = new_regions
            self._tmp_local_region = new_local_region
            yield
        finally:
            self._tmp_regions = old_regions
            self._tmp_local_region = old_local_region

    @property
    def regions(self) -> frozenset[Region]:
        return super().regions if self._tmp_regions is None else self._tmp_regions

    @property
    def local_region(self) -> Region | None:
        return super().local_region if self._tmp_local_region is None else self._tmp_local_region

    def get_by_name(self, region_name: str) -> Region | None:
        if self._tmp_regions is None:
            return super().get_by_name(region_name)

        match = (r for r in self._tmp_regions if r.name == region_name)
        try:
            return next(match)
        except StopIteration:
            return None


def get_test_env_directory() -> TestEnvRegionDirectory:
    directory = get_global_directory()
    assert isinstance(directory, TestEnvRegionDirectory)
    return directory


@contextmanager
def override_regions(regions: Sequence[Region], local_region: Region | None = None):
    """Override the global set of existing regions.

    The overriding value takes the place of the `SENTRY_REGION_CONFIG` setting and
    changes the behavior of the module-level functions in `sentry.types.region`. This
    is preferable to overriding the `SENTRY_REGION_CONFIG` setting value directly
    because the region mapping may already be cached.
    """
    with get_test_env_directory().swap_state(regions, local_region=local_region):
        yield


@contextmanager
def in_local_region(region: Region):
    """Override the local region of the simulated region silo.

    The overriding value takes the place of the `SENTRY_REGION` setting and changes
    the behavior of the module-level functions in `sentry.types.region`. This is
    preferable to overriding the `SENTRY_REGION` setting value directly because the
    region mapping may already be cached.
    """
    with get_test_env_directory().swap_state(local_region=region):
        yield
