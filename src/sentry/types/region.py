from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Iterable

from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models import Organization


class RegionCategory(Enum):
    GEOGRAPHIC = "GEOGRAPHIC"
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

    In a production environment, this would typically be a subdomain (e.g.,
    "eu.sentry.io"). In a development environment, it may be useful to define
    region addresses as a custom hostname or port number (e.g,
    "localhost:8001").
    """

    category: RegionCategory
    """The region's category."""

    def __post_init__(self) -> None:
        from sentry.utils.snowflake import REGION_ID

        REGION_ID.validate(self.id)

    def to_url(self, path: str) -> str:
        return self.address + path


class RegionResolutionError(Exception):
    """Indicate that a region's identity could not be resolved."""


class RegionContextError(Exception):
    """Indicate that the server is not in a state to resolve a region."""


class RegionMapping:
    """The set of all regions in this Sentry platform instance."""

    def __init__(self, regions: Iterable[Region]) -> None:
        self.regions = tuple(regions)
        self._by_name = {r.name: r for r in self.regions}
        self._by_id = {r.id: r for r in self.regions}

    @classmethod
    def load_from_config(cls) -> RegionMapping:
        from django.conf import settings

        # For now, assume that all region configs can be taken in through Django
        # settings. We may investigate other ways of delivering those configs in
        # production.
        return cls(settings.SENTRY_REGION_CONFIG)

    def get_by_name(self, name: str) -> Region:
        """Look up a region by name."""
        try:
            return self._by_name[name]
        except KeyError:
            raise RegionResolutionError(f"No region with name: {name!r}")

    def get_by_id(self, id: int) -> Region:
        """Look up a region by numeric ID."""
        try:
            return self._by_id[id]
        except KeyError:
            raise RegionResolutionError(f"No region with numeric ID: {id}")

    def get_for_organization(self, organization: Organization) -> Region:
        """Resolve an organization to the region where its data is stored.

        Raises RegionContextError if this Sentry platform instance is configured to
        run only in monolith mode.
        """

        if not self.regions:
            raise RegionContextError("No regions are configured")

        # Backend representation to be determined. If you are working on code
        # that depends on this method, you can mock it out in unit tests or
        # temporarily hard-code a placeholder.
        raise NotImplementedError

    def get_local_region(self) -> Region | None:
        """Get the region in which this server instance is running.

        Raises RegionContextError if this server instance is not a region silo.
        """

        from django.conf import settings

        if SiloMode.get_current_mode() != SiloMode.REGION:
            raise RegionContextError("Not a region silo")

        if not settings.SENTRY_REGION:
            raise Exception("SENTRY_REGION must be set when server is in REGION silo mode")
        return self.get_by_name(settings.SENTRY_REGION)


_global_region_mapping = None


def get_region_mapping() -> RegionMapping:
    global _global_region_mapping
    if not _global_region_mapping:
        _global_region_mapping = RegionMapping.load_from_config()
    return _global_region_mapping
