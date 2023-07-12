from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

from django.conf import settings

from sentry.services.hybrid_cloud import ArgumentDict
from sentry.services.hybrid_cloud.rpc import RpcServiceUnimplementedException
from sentry.types.region import Region, RegionResolutionError, get_region_by_name

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
class ByRegionName(RegionResolution):
    """Resolve from an `str` parameter representing a region's name"""

    parameter_name: str = "region_name"

    def resolve(self, arguments: ArgumentDict) -> Region:
        region_name = arguments[self.parameter_name]
        return get_region_by_name(region_name)


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


class RequireSingleOrganization(RegionResolution):
    """Resolve to the only region in a single-organization environment.

    Calling a service method with this resolution strategy will cause an error if the
    environment is not configured with the "single organization" or has more than one
    region.
    """

    def resolve(self, arguments: ArgumentDict) -> Region:
        if not settings.SENTRY_SINGLE_ORGANIZATION:
            raise RegionResolutionError("Method is available only in single-org environment")

        all_region_names = list(
            self.organization_mapping_manager.all()
            .values_list("region_name", flat=True)
            .distinct()[:2]
        )
        if len(all_region_names) == 0:
            return get_region_by_name(settings.SENTRY_MONOLITH_REGION)
        if len(all_region_names) != 1:
            raise RegionResolutionError("Expected single-org environment to have only one region")

        (single_region_name,) = all_region_names
        return get_region_by_name(single_region_name)


class UnimplementedRegionResolution(RegionResolution):
    """Indicate that a method's region resolution logic has not been implemented yet.

    A remote call to the method will be interrupted and will default to the
    monolithic fallback implementation. See the RpcServiceUnimplementedException
    documentation for details.
    """

    def resolve(self, arguments: ArgumentDict) -> Region:
        raise RpcServiceUnimplementedException("Need to resolve to remote region silo")
