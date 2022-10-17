from __future__ import annotations

import functools
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Iterable

from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models import Organization


class RegionCategory(Enum):
    MULTI_TENANT = "MULTI_TENANT"
    SINGLE_TENANT = "SINGLE_TENANT"


@dataclass(frozen=True, eq=True)
class Region:
    """A region of the Sentry platform, hosted by a region silo."""

    name: str
    """The region's unique identifier."""

    id: int
    """The region's unique numeric representation.

    This number is used for composing "snowflake" IDs, and must fit inside the
    maximum bit length specified by our snowflake ID schema.
    """

    address: str
    """The address of the region's silo.

    Represent a region's hostname or subdomain in a production environment
    (e.g., "eu.sentry.io"), and addresses such as "localhost:8001" in a dev
    environment.

    (This attribute is a placeholder. Please update this docstring when its
    contract becomes more stable.)
    """

    category: RegionCategory
    """The region's category."""

    def __post_init__(self) -> None:
        from sentry.utils.snowflake import NULL_REGION_ID, REGION_ID

        REGION_ID.validate(self.id)
        if self.id == NULL_REGION_ID:
            raise ValueError(f"Region ID {NULL_REGION_ID} is reserved for non-multi-region systems")

    def to_url(self, path: str) -> str:
        """Resolve a path into a URL on this region's silo.

        (This method is a placeholder. See the `address` attribute.)
        """
        return self.address + path


class RegionResolutionError(Exception):
    """Indicate that a region's identity could not be resolved."""


class RegionContextError(Exception):
    """Indicate that the server is not in a state to resolve a region."""


class _RegionMapping:
    """The set of all regions in this Sentry platform instance."""

    def __init__(self, regions: Iterable[Region]) -> None:
        self.regions = frozenset(regions)
        self.by_name = {r.name: r for r in self.regions}
        self.by_id = {r.id: r for r in self.regions}


@functools.lru_cache(maxsize=1)
def _load_global_regions() -> _RegionMapping:
    from django.conf import settings

    # For now, assume that all region configs can be taken in through Django
    # settings. We may investigate other ways of delivering those configs in
    # production.
    return _RegionMapping(settings.SENTRY_REGION_CONFIG)


def get_region_by_name(name: str) -> Region:
    """Look up a region by name."""
    try:
        return _load_global_regions().by_name[name]
    except KeyError:
        raise RegionResolutionError(f"No region with name: {name!r}")


def get_region_by_id(id: int) -> Region:
    """Look up a region by numeric ID."""
    try:
        return _load_global_regions().by_id[id]
    except KeyError:
        raise RegionResolutionError(f"No region with numeric ID: {id}")


def get_region_for_organization(organization: Organization) -> Region:
    """Resolve an organization to the region where its data is stored.

    Raises RegionContextError if this Sentry platform instance is configured to
    run only in monolith mode.
    """
    mapping = _load_global_regions()

    if not mapping.regions:
        raise RegionContextError("No regions are configured")

    # Backend representation to be determined. If you are working on code
    # that depends on this method, you can mock it out in unit tests or
    # temporarily hard-code a placeholder.
    raise NotImplementedError


def get_local_region() -> Region:
    """Get the region in which this server instance is running.

    Raises RegionContextError if this server instance is not a region silo.
    """
    from django.conf import settings

    if SiloMode.get_current_mode() != SiloMode.REGION:
        raise RegionContextError("Not a region silo")

    if not settings.SENTRY_REGION:
        raise Exception("SENTRY_REGION must be set when server is in REGION silo mode")
    return get_region_by_name(settings.SENTRY_REGION)
