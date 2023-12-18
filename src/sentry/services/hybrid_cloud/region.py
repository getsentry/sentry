from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from django.conf import settings

from sentry.services.hybrid_cloud import ArgumentDict
from sentry.types.region import (
    Region,
    RegionMappingNotFound,
    RegionResolutionError,
    get_region_by_name,
)


class RegionResolutionStrategy(ABC):
    """Interface for directing a service call to a remote region."""

    @abstractmethod
    def resolve(self, arguments: ArgumentDict) -> Region:
        """Return the region determined by a service call's arguments."""
        raise NotImplementedError

    @staticmethod
    def _get_from_mapping(**query: Any) -> Region:
        from sentry.models.organizationmapping import OrganizationMapping

        try:
            mapping = OrganizationMapping.objects.get(**query)
        except OrganizationMapping.DoesNotExist as e:
            raise RegionMappingNotFound from e

        return get_region_by_name(mapping.region_name)


@dataclass(frozen=True)
class ByOrganizationObject(RegionResolutionStrategy):
    """Resolve from a parameter representing an organization object."""

    parameter_name: str = "organization"

    def resolve(self, arguments: ArgumentDict) -> Region:
        value = arguments[self.parameter_name]
        return self._get_from_mapping(organization_id=value.id)


@dataclass(frozen=True)
class ByRegionName(RegionResolutionStrategy):
    """Resolve from an `str` parameter representing a region's name"""

    parameter_name: str = "region_name"

    def resolve(self, arguments: ArgumentDict) -> Region:
        region_name = arguments[self.parameter_name]
        return get_region_by_name(region_name)


@dataclass(frozen=True)
class ByOrganizationId(RegionResolutionStrategy):
    """Resolve from an `int` parameter representing an organization ID."""

    parameter_name: str = "organization_id"

    def resolve(self, arguments: ArgumentDict) -> Region:
        organization_id = arguments[self.parameter_name]
        return self._get_from_mapping(organization_id=organization_id)


@dataclass(frozen=True)
class ByOrganizationSlug(RegionResolutionStrategy):
    """Resolve from a `str` parameter representing an organization slug."""

    parameter_name: str = "slug"

    def resolve(self, arguments: ArgumentDict) -> Region:
        slug = arguments[self.parameter_name]
        return self._get_from_mapping(slug=slug)


@dataclass(frozen=True)
class ByOrganizationIdAttribute(RegionResolutionStrategy):
    """Resolve from an object with an organization ID as one of its attributes."""

    parameter_name: str
    attribute_name: str = "organization_id"

    def resolve(self, arguments: ArgumentDict) -> Region:
        argument = arguments[self.parameter_name]
        organization_id = getattr(argument, self.attribute_name)
        return self._get_from_mapping(organization_id=organization_id)


class RequireSingleOrganization(RegionResolutionStrategy):
    """Resolve to the only region in a single-organization environment.

    Calling a service method with this resolution strategy will cause an error if the
    environment is not configured with the "single organization" or has more than one
    region.
    """

    def resolve(self, arguments: ArgumentDict) -> Region:
        from sentry.models.organizationmapping import OrganizationMapping

        if not settings.SENTRY_SINGLE_ORGANIZATION:
            raise RegionResolutionError("Method is available only in single-org environment")

        all_region_names = list(
            OrganizationMapping.objects.all().values_list("region_name", flat=True).distinct()[:2]
        )
        if len(all_region_names) == 0:
            return get_region_by_name(settings.SENTRY_MONOLITH_REGION)
        if len(all_region_names) != 1:
            raise RegionResolutionError("Expected single-org environment to have only one region")

        (single_region_name,) = all_region_names
        return get_region_by_name(single_region_name)
