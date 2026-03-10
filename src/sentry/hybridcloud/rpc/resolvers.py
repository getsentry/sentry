from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from django.conf import settings

from sentry.hybridcloud.rpc import ArgumentDict
from sentry.types.region import (
    Cell,
    RegionMappingNotFound,
    RegionResolutionError,
    get_cell_by_name,
)


class CellResolutionStrategy(ABC):
    """Interface for directing a service call to a remote cell."""

    @abstractmethod
    def resolve(self, arguments: ArgumentDict) -> Cell:
        """Return the cell determined by a service call's arguments."""
        raise NotImplementedError

    @staticmethod
    def _get_from_mapping(**query: Any) -> Cell:
        from sentry.models.organizationmapping import OrganizationMapping

        try:
            mapping = OrganizationMapping.objects.get(**query)
        except OrganizationMapping.DoesNotExist as e:
            raise RegionMappingNotFound from e

        return get_cell_by_name(mapping.cell_name)


@dataclass(frozen=True)
class ByCellName(CellResolutionStrategy):
    """Resolve from a `str` parameter representing a cell's name.

    Accepts either ``cell_name`` or ``region_name`` to ease the migration of
    service method parameters from the old name to the new one.
    """

    parameter_name: str = "cell_name"

    def resolve(self, arguments: ArgumentDict) -> Cell:
        # TODO(cells): Temporary fall back to "region_name" while service methods are being migrated.
        cell_name = arguments.get("region_name") or arguments[self.parameter_name]
        return get_cell_by_name(cell_name)


@dataclass(frozen=True)
class ByOrganizationId(CellResolutionStrategy):
    """Resolve from an `int` parameter representing an organization ID."""

    parameter_name: str = "organization_id"

    def resolve(self, arguments: ArgumentDict) -> Cell:
        organization_id = arguments[self.parameter_name]
        return self._get_from_mapping(organization_id=organization_id)


@dataclass(frozen=True)
class ByOrganizationSlug(CellResolutionStrategy):
    """Resolve from a `str` parameter representing an organization slug."""

    parameter_name: str = "slug"

    def resolve(self, arguments: ArgumentDict) -> Cell:
        slug = arguments[self.parameter_name]
        return self._get_from_mapping(slug=slug)


@dataclass(frozen=True)
class ByOrganizationIdAttribute(CellResolutionStrategy):
    """Resolve from an object with an organization ID as one of its attributes."""

    parameter_name: str
    attribute_name: str = "organization_id"

    def resolve(self, arguments: ArgumentDict) -> Cell:
        argument = arguments[self.parameter_name]
        organization_id = getattr(argument, self.attribute_name)
        return self._get_from_mapping(organization_id=organization_id)


class RequireSingleOrganization(CellResolutionStrategy):
    """Resolve to the only cell in a single-organization environment.

    Calling a service method with this resolution strategy will cause an error if the
    environment is not configured with the "single organization" or has more than one
    cell.
    """

    def resolve(self, arguments: ArgumentDict) -> Cell:
        from sentry.models.organizationmapping import OrganizationMapping

        if not settings.SENTRY_SINGLE_ORGANIZATION:
            raise RegionResolutionError("Method is available only in single-org environment")

        all_cell_names = list(
            OrganizationMapping.objects.all().values_list("cell_name", flat=True).distinct()[:2]
        )
        if len(all_cell_names) == 0:
            return get_cell_by_name(settings.SENTRY_MONOLITH_REGION)
        if len(all_cell_names) != 1:
            raise RegionResolutionError("Expected single-org environment to have only one cell")

        (single_cell_name,) = all_cell_names
        return get_cell_by_name(single_cell_name)


# TODO(cells): Remove once all callers have been migrated to new names
ByRegionName = ByCellName
