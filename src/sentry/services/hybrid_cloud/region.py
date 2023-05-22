from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sentry.services.hybrid_cloud import ArgumentDict
from sentry.services.hybrid_cloud.rpc import RpcServiceUnimplementedException
from sentry.types.region import Region, get_region_by_name

if TYPE_CHECKING:
    from sentry.db.models import BaseManager
    from sentry.models import OrganizationMapping


class RegionResolution(ABC):
    """Interface for directing a service call to a remote region."""

    @abstractmethod
    def resolve(self, arguments: ArgumentDict) -> Region:
        """Return the region determined by a service call's arguments."""
        raise NotImplementedError

    @staticmethod
    def _resolve_from_mapping(mapping: OrganizationMapping) -> Region:
        return get_region_by_name(mapping.region_name)

    @property
    def organization_mapping_manager(self) -> BaseManager[OrganizationMapping]:
        from sentry.models import OrganizationMapping

        # Convenience method to avoid repeating the local import
        return OrganizationMapping.objects


@dataclass(frozen=True)
class ByOrganizationObject(RegionResolution):
    """Resolve from a parameter representing an organization object."""

    parameter_name: str = "organization"

    def resolve(self, arguments: ArgumentDict) -> Region:
        value = arguments[self.parameter_name]
        mapping = self.organization_mapping_manager.get(organization_id=value.id)
        return self._resolve_from_mapping(mapping)


@dataclass(frozen=True)
class ByOrganizationId(RegionResolution):
    """Resolve from an `int` parameter representing an organization ID."""

    parameter_name: str = "organization_id"

    def resolve(self, arguments: ArgumentDict) -> Region:
        organization_id = arguments[self.parameter_name]
        mapping = self.organization_mapping_manager.get(organization_id=organization_id)
        return self._resolve_from_mapping(mapping)


@dataclass(frozen=True)
class ByOrganizationSlug(RegionResolution):
    """Resolve from a `str` parameter representing an organization slug."""

    parameter_name: str = "slug"

    def resolve(self, arguments: ArgumentDict) -> Region:
        slug = arguments[self.parameter_name]
        mapping = self.organization_mapping_manager.get(slug=slug)
        return self._resolve_from_mapping(mapping)


@dataclass(frozen=True)
class ByOrganizationIdAttribute(RegionResolution):
    """Resolve from an object with an organization ID as one of its attributes."""

    parameter_name: str
    attribute_name: str = "organization_id"

    def resolve(self, arguments: ArgumentDict) -> Region:
        argument = arguments[self.parameter_name]
        organization_id = getattr(argument, self.attribute_name)
        mapping = self.organization_mapping_manager.get(organization_id=organization_id)
        return self._resolve_from_mapping(mapping)


class UnimplementedRegionResolution(RegionResolution):
    """Indicate that a method's region resolution logic has not been implemented yet.

    A remote call to the method will be interrupted and will default to the
    monolithic fallback implementation. See the RpcServiceUnimplementedException
    documentation for details.
    """

    def resolve(self, arguments: ArgumentDict) -> Region:
        raise RpcServiceUnimplementedException("Need to resolve to remote region silo")
