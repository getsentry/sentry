from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Collection, Container, Iterable, Set
from urllib.parse import urljoin

from django.conf import settings

from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.silo import SiloMode
from sentry.utils import json


class RegionCategory(Enum):
    MULTI_TENANT = "MULTI_TENANT"
    SINGLE_TENANT = "SINGLE_TENANT"


class RegionConfigurationError(Exception):
    """Indicate that a region was misconfigured or could not be initialized."""


@dataclass(frozen=True, eq=True)
class Region:
    """A region of the Sentry platform, hosted by a region silo."""

    name: str
    """The region's unique identifier."""

    snowflake_id: int
    """The region's unique numeric representation for composing "snowflake" IDs.

    Avoid using this in any context other than creating a new snowflake ID. Prefer
    the name as the region's unique identifier. Snowflake IDs need to remain mutually
    unique only within the same timestamp, so the meaning of a number may not be
    stable over time if we ever choose to reassign or reuse the values.

    The number must fit inside the maximum bit length specified by our snowflake ID
    schema.
    """

    address: str
    """The address of the region's silo.

    Represent a region's hostname or subdomain in a production environment
    (e.g., "https://eu.sentry.io"), and addresses such as "http://localhost:8001" in a dev
    environment.

    (This attribute is a placeholder. Please update this docstring when its
    contract becomes more stable.)
    """

    category: RegionCategory
    """The region's category."""

    # TODO: Possibly change auth schema in final implementation.
    api_token: str | None = None

    def validate(self) -> None:
        from sentry import options
        from sentry.api.utils import generate_region_url
        from sentry.utils.snowflake import REGION_ID

        REGION_ID.validate(self.snowflake_id)

        # Validate address with respect to self.name for multi-tenant regions.
        region_url_template: str | None = options.get("system.region-api-url-template")
        if (
            SiloMode.get_current_mode() != SiloMode.MONOLITH
            and self.category == RegionCategory.MULTI_TENANT
            and region_url_template is not None
            and self.name != settings.SENTRY_MONOLITH_REGION
        ):
            expected_address = generate_region_url(self.name)
            if self.address != expected_address:
                raise RegionConfigurationError(
                    f"Expected address for {self.name} to be: {expected_address}. Was defined as: {self.address}"
                )

    def to_url(self, path: str) -> str:
        """Resolve a path into a URL on this region's silo.

        (This method is a placeholder. See the `address` attribute.)
        """
        return urljoin(self.address, path)


class RegionResolutionError(Exception):
    """Indicate that a region's identity could not be resolved."""


class RegionContextError(Exception):
    """Indicate that the server is not in a state to resolve a region."""


class GlobalRegionDirectory:
    """The set of all regions in this Sentry platform instance."""

    def __init__(self, regions: Collection[Region]) -> None:
        if not any(r.name == settings.SENTRY_MONOLITH_REGION for r in regions):
            default_monolith_region = Region(
                name=settings.SENTRY_MONOLITH_REGION,
                snowflake_id=0,
                address="/",
                category=RegionCategory.MULTI_TENANT,
            )
            regions = [default_monolith_region, *regions]

        self.regions = frozenset(regions)
        self.by_name = {r.name: r for r in self.regions}

    def validate_all(self) -> None:
        for region in self.regions:
            region.validate()


def _parse_config(region_config: Any) -> Iterable[Region]:
    if isinstance(region_config, (str, bytes)):
        config_values = json.loads(region_config)
    else:
        config_values = region_config

    if not isinstance(config_values, (list, tuple)):
        config_values = [config_values]

    for config_value in config_values:
        if isinstance(config_value, Region):
            yield config_value
        else:
            config_value["category"] = RegionCategory[config_value["category"]]
            yield Region(**config_value)


def load_from_config(region_config: Any) -> GlobalRegionDirectory:
    region_objs = list(_parse_config(region_config))
    return GlobalRegionDirectory(region_objs)


_global_regions: GlobalRegionDirectory | None = None


def load_global_regions() -> GlobalRegionDirectory:
    global _global_regions
    if _global_regions is not None:
        return _global_regions

    from django.conf import settings

    # For now, assume that all region configs can be taken in through Django
    # settings. We may investigate other ways of delivering those configs in
    # production.
    _global_regions = load_from_config(settings.SENTRY_REGION_CONFIG)
    return _global_regions


def clear_global_regions() -> None:
    global _global_regions
    _global_regions = None


def get_region_by_name(name: str) -> Region:
    """Look up a region by name."""
    try:
        return load_global_regions().by_name[name]
    except KeyError:
        raise RegionResolutionError(f"No region with name: {name!r}")


@control_silo_function
def get_region_for_organization(organization_slug: str) -> Region:
    """Resolve an organization to the region where its data is stored."""
    from sentry.models.organizationmapping import OrganizationMapping

    mapping = OrganizationMapping.objects.filter(slug=organization_slug).first()
    if not mapping:
        raise RegionResolutionError(f"Organization {organization_slug} has no associated mapping.")

    return get_region_by_name(name=mapping.region_name)


def get_local_region() -> Region:
    """Get the region in which this server instance is running.

    Raises RegionContextError if this server instance is not a region silo.
    """
    from django.conf import settings

    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return get_region_by_name(settings.SENTRY_MONOLITH_REGION)

    if SiloMode.get_current_mode() != SiloMode.REGION:
        raise RegionContextError("Not a region silo")

    if not settings.SENTRY_REGION:
        raise Exception("SENTRY_REGION must be set when server is in REGION silo mode")
    return get_region_by_name(settings.SENTRY_REGION)


@control_silo_function
def _find_orgs_for_user(user_id: int) -> Set[int]:
    from sentry.models import OrganizationMemberMapping

    return {
        m["organization_id"]
        for m in OrganizationMemberMapping.objects.filter(user_id=user_id).values("organization_id")
    }


def find_regions_for_orgs(org_ids: Container[int]) -> Set[str]:
    from sentry.models import OrganizationMapping

    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return {settings.SENTRY_MONOLITH_REGION}
    else:
        return set(
            OrganizationMapping.objects.filter(organization_id__in=org_ids).values_list(
                "region_name", flat=True
            )
        )


@control_silo_function
def find_regions_for_user(user_id: int) -> Set[str]:
    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return {settings.SENTRY_MONOLITH_REGION}

    org_ids = _find_orgs_for_user(user_id)
    return find_regions_for_orgs(org_ids)


def find_all_region_names() -> Iterable[str]:
    return load_global_regions().by_name.keys()
