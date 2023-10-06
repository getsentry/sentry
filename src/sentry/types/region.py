from __future__ import annotations

from enum import Enum
from typing import Any, Collection, Container, Dict, Iterable, List, Optional, Set
from urllib.parse import urljoin

import sentry_sdk
from django.conf import settings
from pydantic.dataclasses import dataclass
from pydantic.tools import parse_obj_as

from sentry import options
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.silo import SiloMode, single_process_silo_mode_state
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

    Represent a region's hostname or IP address on the non-public network. This address
    is used for RPC routing.

    (e.g., "https://de.internal.getsentry.net" or https://10.21.99.10), and addresses
    such as "http://localhost:8001" in a dev environment.

    The customer facing address for a region is derived from a region's name
    and `system.region-api-url-template`
    """

    category: RegionCategory
    """The region's category."""

    api_token: Optional[str] = None
    """Unused will be removed in the future"""

    def validate(self) -> None:
        from sentry.utils.snowflake import REGION_ID

        REGION_ID.validate(self.snowflake_id)

    def to_url(self, path: str) -> str:
        """Resolve a path into a customer facing URL on this region's silo.

        In monolith mode, there is likely only the historical simulated
        region. The public URL of the simulated region is the same
        as the application base URL.
        """
        from sentry.api.utils import generate_region_url

        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            base_url = options.get("system.url-prefix")
        else:
            base_url = generate_region_url(self.name)

        return urljoin(base_url, path)

    def api_serialize(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "url": self.to_url(""),
        }

    def is_historic_monolith_region(self) -> bool:
        """Check whether this is a historic monolith region.

        In a monolith environment, there exists only the one monolith "region",
        which is a dummy object.

        In a siloed environment whose data was migrated from a monolith environment,
        all region-scoped entities that existed before the migration belong to the
        historic monolith region by default. Unlike in the monolith environment,
        this region is not a dummy object, but nonetheless is subject to special
        cases to ensure that legacy data is handled correctly.
        """

        return self.name == settings.SENTRY_MONOLITH_REGION


class RegionResolutionError(Exception):
    """Indicate that a region's identity could not be resolved."""


class RegionMappingNotFound(RegionResolutionError):
    """Indicate that a mapping to a region could not be found."""


class RegionContextError(Exception):
    """Indicate that the server is not in a state to resolve a region."""


class GlobalRegionDirectory:
    """The set of all regions in this Sentry platform instance."""

    def __init__(self, regions: Collection[Region]) -> None:
        if not regions:
            default_monolith_region = Region(
                name=settings.SENTRY_MONOLITH_REGION,
                snowflake_id=0,
                address=options.get("system.url-prefix"),
                category=RegionCategory.MULTI_TENANT,
            )
            regions = [default_monolith_region]
        elif not any(r.name == settings.SENTRY_MONOLITH_REGION for r in regions):
            raise RegionConfigurationError(
                "The SENTRY_MONOLITH_REGION setting must point to a region name "
                f"({settings.SENTRY_MONOLITH_REGION=!r}; "
                f"region names = {[r.name for r in regions]!r})"
            )

        self.regions = frozenset(regions)
        self.by_name = {r.name: r for r in self.regions}

    def validate_all(self) -> None:
        for region in self.regions:
            region.validate()


def parse_raw_config(region_config: Any) -> Iterable[Region]:
    if isinstance(region_config, (str, bytes)):
        json_config_values = json.loads(region_config)
        config_values = parse_obj_as(List[Region], json_config_values)
    else:
        config_values = region_config

    if not isinstance(config_values, (list, tuple)):
        config_values = [config_values]  # type: ignore

    for config_value in config_values:
        if isinstance(config_value, Region):
            yield config_value
        else:
            category = config_value["category"]  # type: ignore[unreachable]
            config_value["category"] = (
                category if isinstance(category, RegionCategory) else RegionCategory[category]
            )
            yield Region(**config_value)


def load_from_config(region_config: Any) -> GlobalRegionDirectory:
    try:
        region_objs = list(parse_raw_config(region_config))
        return GlobalRegionDirectory(region_objs)
    except RegionConfigurationError as e:
        sentry_sdk.capture_exception(e)
        raise
    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise RegionConfigurationError("Unable to parse region_config.") from e


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
    global_regions = load_global_regions()
    try:
        return global_regions.by_name[name]
    except KeyError as e:
        region_names = [
            r.name for r in global_regions.regions if r.category == RegionCategory.MULTI_TENANT
        ]
        raise RegionResolutionError(
            f"No region with name: {name!r} "
            f"(expected one of {region_names!r} or a single-tenant name)"
        ) from e


def is_region_name(name: str) -> bool:
    return name in load_global_regions().by_name


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

    # In our threaded acceptance tests, we need to override the region of the current
    # context when passing through test rpc calls, but we can't rely on settings because
    # django settings are not thread safe :'(
    # We use this thread local instead which is managed by the SiloMode context managers
    if single_process_silo_mode_state.region:
        return single_process_silo_mode_state.region

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


@control_silo_function
def find_regions_for_orgs(org_ids: Container[int]) -> Set[str]:
    from sentry.models.organizationmapping import OrganizationMapping

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


def find_all_multitenant_region_names() -> List[str]:
    return [
        region.name
        for region in load_global_regions().regions
        if region.category == RegionCategory.MULTI_TENANT
    ]
