from __future__ import annotations

from collections.abc import Collection, Generator, Sequence
from contextlib import contextmanager

from django.test import override_settings

from sentry.types.region import Locality, Region, RegionDirectory, get_global_directory


class TestEnvRegionDirectory(RegionDirectory):
    __test__ = False

    def __init__(self, regions: Collection[Region]) -> None:
        super().__init__(regions, frozenset())
        self._default_region = next(iter(regions))
        self._apply_regions(regions)

    def _apply_regions(self, regions: Collection[Region]) -> None:
        localities = frozenset(
            Locality(name=r.name, cells=frozenset([r.name]), category=r.category, visible=r.visible)
            for r in regions
        )
        self._cells = frozenset(regions)
        self._by_name = {r.name: r for r in self._cells}
        self._localities = localities
        self._localities_by_name = {loc.name: loc for loc in localities}
        self._cell_to_locality = {cell_name: loc for loc in localities for cell_name in loc.cells}

    @contextmanager
    def swap_state(
        self,
        regions: Sequence[Region],
        local_region: Region | None = None,
    ) -> Generator[None]:
        prev_state = (
            self._default_region,
            self._cells,
            self._by_name,
            self._localities,
            self._localities_by_name,
            self._cell_to_locality,
        )
        try:
            self._default_region = local_region or regions[0]
            self._apply_regions(regions)
            monolith_region = regions[0]
            with override_settings(SENTRY_MONOLITH_REGION=monolith_region.name):
                if local_region:
                    with override_settings(SENTRY_REGION=local_region.name):
                        yield
                else:
                    yield
        finally:
            (
                self._default_region,
                self._cells,
                self._by_name,
                self._localities,
                self._localities_by_name,
                self._cell_to_locality,
            ) = prev_state

    @contextmanager
    def swap_to_default_region(self) -> Generator[None]:
        """Swap to the monolith region when entering region mode."""
        with override_settings(SENTRY_REGION=self._default_region.name):
            yield

    @contextmanager
    def swap_to_region_by_name(self, region_name: str) -> Generator[None]:
        """Swap to the specified region when entering region mode."""
        region = self.get_cell_by_name(region_name)
        if region is None:
            raise Exception("specified swap region not found")
        with override_settings(SENTRY_REGION=region.name):
            yield


def get_test_env_directory() -> TestEnvRegionDirectory:
    directory = get_global_directory()
    assert isinstance(directory, TestEnvRegionDirectory)
    return directory


@contextmanager
def override_regions(
    regions: Sequence[Region], local_region: Region | None = None
) -> Generator[None]:
    """Override the global set of existing regions.

    The overriding value takes the place of the `SENTRY_REGION_CONFIG` setting and
    changes the behavior of the module-level functions in `sentry.types.region`. This
    is preferable to overriding the `SENTRY_REGION_CONFIG` setting value directly
    because the region mapping may already be cached.
    """
    with get_test_env_directory().swap_state(regions, local_region=local_region):
        yield
