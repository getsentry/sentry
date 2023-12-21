from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import Collection, Sequence

from sentry.silo import SiloMode
from sentry.types.region import Region, RegionDirectory, get_global_directory


@dataclass(frozen=True)
class _TemporaryRegionDirectoryState:
    regions: frozenset[Region]
    local_region: Region | None
    default_region: Region


class TestEnvRegionDirectory(RegionDirectory):
    def __init__(self, regions: Collection[Region], local_region: Region | None) -> None:
        super().__init__(regions, local_region)
        self._tmp_state = _TemporaryRegionDirectoryState(
            super().regions, super().local_region, next(iter(regions))
        )

    @contextmanager
    def swap_state(
        self,
        regions: Sequence[Region] | None = None,
        local_region: Region | None = None,
    ):
        new_state = _TemporaryRegionDirectoryState(
            regions=self.regions if regions is None else frozenset(regions),
            local_region=(
                local_region
                or (self.local_region if (self.local_region is None or not regions) else regions[0])
            ),
            default_region=self._tmp_state.default_region if regions is None else regions[0],
        )

        old_state = self._tmp_state
        try:
            self._tmp_state = new_state
            yield
        finally:
            self._tmp_state = old_state

    @contextmanager
    def swap_to_default_region(self):
        """Swap to an arbitrary region when entering region mode."""
        with self.swap_state(local_region=self._tmp_state.default_region):
            yield

    @property
    def regions(self) -> frozenset[Region]:
        return self._tmp_state.regions

    @property
    def local_region(self) -> Region | None:
        return self._tmp_state.local_region

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


@contextmanager
def in_local_region(region: Region):
    """Override the local region of the simulated region silo.

    The overriding value takes the place of the `SENTRY_REGION` setting and changes
    the behavior of the module-level functions in `sentry.types.region`. This is
    preferable to overriding the `SENTRY_REGION` setting value directly because the
    region mapping may already be cached.
    """
    if SiloMode.get_current_mode() == SiloMode.REGION:
        with get_test_env_directory().swap_state(local_region=region):
            yield
    elif SiloMode.get_current_mode() == SiloMode.CONTROL:
        raise Exception("Can't swap local region in control silo")
    else:
        # In monolith mode, the `local_region` pointer is expected to be initialized
        # to the SENTRY_MONOLITH_REGION value and stay there. So don't swap anything.
        yield


@contextmanager
def assume_test_region_mode(region: Region):
    from sentry.testutils.silo import assume_test_silo_mode

    with assume_test_silo_mode(SiloMode.REGION), in_local_region(region):
        yield
