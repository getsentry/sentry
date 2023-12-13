from __future__ import annotations

from enum import Enum
from typing import Any, Collection, Container, Dict, Iterable, List, Optional, Set
from urllib.parse import urljoin

import sentry_sdk
from django.conf import settings
from django.http import HttpRequest
from pydantic.dataclasses import dataclass
from pydantic.tools import parse_obj_as

from sentry import options
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.silo import SiloMode, single_process_silo_mode_state
from sentry.utils import json
from sentry.utils.env import in_test_environment


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


class RegionDirectory:
    """A set of regions in a Sentry environment.

    In a production environment, there will be only one instance of this class,
    held in a singleton GlobalRegionDirectory.

    In a test environment, the singleton GlobalRegionDirectory may have
    RegionDirectory instances temporarily swapped into it.
    """

    def __init__(self, regions: Collection[Region], local_region: Region | None) -> None:
        self._regions = frozenset(regions)
        self._local_region = local_region
        self._by_name = {r.name: r for r in regions}

    @property
    def regions(self) -> frozenset[Region]:
        return self._regions

    @property
    def local_region(self) -> Region | None:
        return self._local_region

    def get_by_name(self, region_name: str) -> Region | None:
        return self._by_name.get(region_name)

    def get_region_names(self, category: RegionCategory | None = None) -> Iterable[str]:
        return (r.name for r in self.regions if (category is None or r.category == category))

    def validate_all(self) -> None:
        for region in self.regions:
            region.validate()


def _parse_raw_config(region_config: Any) -> Iterable[Region]:
    if isinstance(region_config, (str, bytes)):
        json_config_values = json.loads(region_config)
        config_values = parse_obj_as(List[Region], json_config_values)
    else:
        config_values = region_config

    if not isinstance(config_values, (list, tuple)):
        config_values = [config_values]  # type: ignore[unreachable]

    for config_value in config_values:
        if isinstance(config_value, Region):
            yield config_value
        else:
            category = config_value["category"]  # type: ignore[unreachable]
            config_value["category"] = (
                category if isinstance(category, RegionCategory) else RegionCategory[category]
            )
            yield Region(**config_value)


def _determine_region_pointers(regions: Collection[Region]) -> tuple[Region, Region | None]:
    """Determine the monolith and local region from config."""

    silo_mode = SiloMode.get_current_mode()
    by_name = {r.name: r for r in regions}

    def resolve(setting_name: str) -> RegionConfigurationError:
        setting_value = getattr(settings, setting_name)
        try:
            return by_name[setting_value]
        except KeyError as e:
            region_names = ", ".join(map(repr, by_name.keys()))
            raise RegionConfigurationError(
                f"The {setting_name} setting (value={setting_value!r}) must point to "
                f"a region name. Region names: {region_names})"
            ) from e

    if silo_mode == SiloMode.MONOLITH and not regions:
        if not settings.SENTRY_MONOLITH_REGION:
            raise RegionConfigurationError("`SENTRY_MONOLITH_REGION` must be set")
        monolith_region = Region(
            name=settings.SENTRY_MONOLITH_REGION,
            snowflake_id=0,
            address=options.get("system.url-prefix"),
            category=RegionCategory.MULTI_TENANT,
        )
    else:
        monolith_region = resolve("SENTRY_MONOLITH_REGION")

    if silo_mode == SiloMode.MONOLITH:
        local_region = monolith_region
    elif silo_mode == SiloMode.CONTROL:
        local_region = None
    elif silo_mode == SiloMode.REGION:
        local_region = resolve("SENTRY_REGION")
    else:
        raise Exception("Invalid silo mode")
    return monolith_region, local_region


def load_from_config(region_config: Any) -> RegionDirectory:
    try:
        regions = set(_parse_raw_config(region_config))
        monolith_region, local_region = _determine_region_pointers(regions)
        regions.add(monolith_region)  # in case a default was generated
        return RegionDirectory(regions, local_region)
    except RegionConfigurationError as e:
        sentry_sdk.capture_exception(e)
        raise
    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise RegionConfigurationError("Unable to parse region_config.") from e


_global_regions: RegionDirectory | None = None


def set_global_directory(directory: RegionDirectory) -> None:
    if not in_test_environment():
        raise Exception(
            "The region directory can be set directly only in a test environment. "
            "Otherwise, it should be automatically loaded from config when "
            "get_global_directory is first called."
        )
    global _global_regions
    _global_regions = directory


def get_global_directory() -> RegionDirectory:
    global _global_regions
    if _global_regions is not None:
        return _global_regions

    from django.conf import settings

    # For now, assume that all region configs can be taken in through Django
    # settings. We may investigate other ways of delivering those configs in
    # production.
    _global_regions = load_from_config(settings.SENTRY_REGION_CONFIG)
    return _global_regions


def get_region_by_name(name: str) -> Region:
    """Look up a region by name."""
    global_regions = get_global_directory()
    region = global_regions.get(name)
    if region is not None:
        return region
    else:
        region_names = global_regions.get_region_names(RegionCategory.MULTI_TENANT)
        raise RegionResolutionError(
            f"No region with name: {name!r} "
            f"(expected one of {region_names!r} or a single-tenant name)"
        )


def is_region_name(name: str) -> bool:
    return get_global_directory().get(name) is not None


def subdomain_is_region(request: HttpRequest) -> bool:
    subdomain = getattr(request, "subdomain", None)
    if subdomain is None:
        return False
    return is_region_name(subdomain)


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

    Return the monolith region if this server instance is in monolith mode.
    Otherwise, it must be a region silo; raise RegionContextError otherwise.
    """

    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        raise RegionContextError("Control silo has no region")
    global_regions = get_global_directory()
    if global_regions.local_region is None:
        raise RegionConfigurationError("Local region is not populated")

    # In our threaded acceptance tests, we need to override the region of the current
    # context when passing through test rpc calls, but we can't rely on settings because
    # django settings are not thread safe :'(
    # We use this thread local instead which is managed by the SiloMode context managers
    if single_process_silo_mode_state.region:
        return single_process_silo_mode_state.region

    return global_regions.local_region


@control_silo_function
def _find_orgs_for_user(user_id: int) -> Set[int]:
    from sentry.models.organizationmembermapping import OrganizationMemberMapping

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
    return get_global_directory().get_region_names()


def find_all_multitenant_region_names() -> List[str]:
    return list(get_global_directory().get_region_names(RegionCategory.MULTI_TENANT))


def find_all_region_addresses() -> Iterable[str]:
    return (r.address for r in get_global_directory().regions)
