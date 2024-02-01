from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import Collection, Sequence

from django.test import override_settings

from sentry.types.region import Region, RegionDirectory, get_global_directory


@dataclass(frozen=True)
class _TemporaryRegionDirectoryState:
    regions: frozenset[Region]
    default_region: Region


class TestEnvRegionDirectory(RegionDirectory):
    def __init__(self, regions: Collection[Region]) -> None:
        super().__init__(regions)
        self._tmp_state = _TemporaryRegionDirectoryState(
            regions=super().regions, default_region=next(iter(regions))
        )

    @contextmanager
    def swap_state(
        self,
        regions: Sequence[Region],
        local_region: Region | None = None,
    ):
        monolith_region = regions[0]
        new_state = _TemporaryRegionDirectoryState(
            regions=self.regions if regions is None else frozenset(regions),
            default_region=local_region or monolith_region,
        )

        old_state = self._tmp_state
        try:
            self._tmp_state = new_state

            with override_settings(SENTRY_MONOLITH_REGION=monolith_region.name):
                if local_region:
                    with override_settings(SENTRY_REGION=local_region.name):
                        yield
                else:
                    yield
        finally:
            self._tmp_state = old_state

    @contextmanager
    def swap_to_default_region(self):
        """Swap to an arbitrary region when entering region mode."""
        with override_settings(SENTRY_REGION=self._tmp_state.default_region.name):
            yield

    @property
    def regions(self) -> frozenset[Region]:
        return self._tmp_state.regions

    def get_by_name(self, region_name: str) -> Region | None:
        match = (r for r in self._tmp_state.regions if r.name == region_name)
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
