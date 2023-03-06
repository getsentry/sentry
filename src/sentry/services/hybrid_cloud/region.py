from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from sentry.models import OrganizationMapping
from sentry.services.hybrid_cloud import ArgumentDict
from sentry.services.hybrid_cloud.rpc import RpcServiceSetupException
from sentry.types.region import Region, get_region_by_name


class RegionResolution(ABC):
    @abstractmethod
    def resolve(self, arguments: ArgumentDict) -> Region:
        raise NotImplementedError

    def _resolve_from_mapping(self, mapping: OrganizationMapping) -> Region:
        return get_region_by_name(mapping.region_name)


@dataclass
class ByOrganizationObject(RegionResolution):
    parameter_name: str | None = None

    def resolve(self, arguments: ArgumentDict) -> Region:
        from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary

        if self.parameter_name is None:
            org_values = [
                arg for arg in arguments.values() if isinstance(arg, RpcOrganizationSummary)
            ]
            if not org_values:
                raise RpcServiceSetupException("Method has no RpcOrganizationSummary parameter")
            if len(org_values) != 1:
                raise RpcServiceSetupException(
                    "Method has multiple RpcOrganizationSummary parameters (specify one by name)"
                )
            (value,) = org_values
        else:
            value = arguments[self.parameter_name]

        mapping = OrganizationMapping.objects.get(organization_id=value.id)
        return self._resolve_from_mapping(mapping)


@dataclass
class ByOrganizationId(RegionResolution):
    parameter_name: str = "organization_id"

    def resolve(self, arguments: ArgumentDict) -> Region:
        organization_id = arguments[self.parameter_name]
        mapping = OrganizationMapping.objects.get(id=organization_id)
        return self._resolve_from_mapping(mapping)


@dataclass
class ByOrganizationSlug(RegionResolution):
    parameter_name: str = "slug"

    def resolve(self, arguments: ArgumentDict) -> Region:
        slug = arguments[self.parameter_name]
        mapping = OrganizationMapping.objects.get(slug=slug)
        return self._resolve_from_mapping(mapping)


@dataclass
class ByOrganizationIdAttribute(RegionResolution):
    parameter_name: str
    attribute_name: str = "organization_id"

    def resolve(self, arguments: ArgumentDict) -> Region:
        argument = arguments[self.parameter_name]
        organization_id = getattr(argument, self.attribute_name)
        mapping = OrganizationMapping.objects.get(id=organization_id)
        return self._resolve_from_mapping(mapping)
