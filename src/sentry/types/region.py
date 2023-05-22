from __future__ import annotations

import functools
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Iterable, Set
from urllib.parse import urljoin

from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.silo import SiloMode
from sentry.utils import json

if TYPE_CHECKING:
    from sentry.models import Organization

MONOLITH_REGION_NAME = "--monolith--"


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

    api_token: str | None = None
    """An API token to authorize RPCs from here to the region's silo."""

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


class _RegionMapping:
    """The set of all regions in this Sentry platform instance."""

    def __init__(self, regions: Iterable[Region]) -> None:
        self.regions = frozenset(regions)
        self.by_name = {r.name: r for r in self.regions}


def _parse_config(region_config: str) -> Iterable[Region]:
    config_values = json.loads(region_config)
    for config_value in config_values:
        config_value["category"] = RegionCategory[config_value["category"]]
        yield Region(**config_value)


@functools.lru_cache(maxsize=1)
def _load_global_regions() -> _RegionMapping:
    from django.conf import settings

    # For now, assume that all region configs can be taken in through Django
    # settings. We may investigate other ways of delivering those configs in
    # production.
    config = settings.SENTRY_REGION_CONFIG
    if isinstance(config, str):
        config = _parse_config(config)
    return _RegionMapping(config)


def get_region_by_name(name: str) -> Region:
    """Look up a region by name."""
    try:
        return _load_global_regions().by_name[name]
    except KeyError:
        raise RegionResolutionError(f"No region with name: {name!r}")


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

    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        # This is a dummy value used to make region.to_url work
        return Region(
            name=MONOLITH_REGION_NAME,
            snowflake_id=0,
            address="/",
            category=RegionCategory.MULTI_TENANT,
        )

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


def find_regions_for_orgs(org_ids: Iterable[int]) -> Set[str]:
    from sentry.models import OrganizationMapping

    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return {
            MONOLITH_REGION_NAME,
        }
    else:
        return {
            t["region_name"]
            for t in OrganizationMapping.objects.filter(organization_id__in=org_ids).values(
                "region_name"
            )
        }


@control_silo_function
def find_regions_for_user(user_id: int) -> Set[str]:
    org_ids = _find_orgs_for_user(user_id)
    return find_regions_for_orgs(org_ids)


def find_all_region_names() -> Iterable[str]:
    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return {MONOLITH_REGION_NAME}
    return _load_global_regions().by_name.keys()
