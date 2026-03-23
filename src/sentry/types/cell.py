from __future__ import annotations

from collections.abc import Collection, Iterable
from enum import Enum
from typing import TYPE_CHECKING, Any
from urllib.parse import urljoin

import sentry_sdk
from django.conf import settings
from django.http import HttpRequest
from pydantic.dataclasses import dataclass

from sentry import options
from sentry.conf.types.cell_config import CellConfig, LocalityConfig
from sentry.silo.base import SiloMode, SingleProcessSiloModeState, control_silo_function
from sentry.utils.env import in_test_environment

if TYPE_CHECKING:
    from sentry.sentry_apps.models.sentry_app import SentryApp


class RegionCategory(Enum):
    MULTI_TENANT = "MULTI_TENANT"
    SINGLE_TENANT = "SINGLE_TENANT"


@dataclass(frozen=True, eq=True)
class Locality:
    """A grouping of one or more cells (e.g. "us" contains "us1", "us2")."""

    name: str
    """The locality's unique identifier (e.g. "us", "de")."""

    cells: frozenset[str]
    """The set of cell names that belong to this locality."""

    category: RegionCategory

    visible: bool = True
    """Whether the locality is visible in API responses."""

    def to_url(self, path: str) -> str:
        """Resolve a path into a customer facing URL on this locality.

        In monolith mode, there is likely only the historical simulated locality.
        The public URL of the simulated locality is the same as the application base URL.
        """
        from sentry.api.utils import generate_locality_url

        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            base_url = options.get("system.url-prefix")
        else:
            base_url = generate_locality_url(self.name)
        return urljoin(base_url, path)

    def api_serialize(self) -> dict[str, Any]:
        return {"name": self.name, "url": self.to_url("")}


class CellConfigurationError(Exception):
    """Indicate that a cell was misconfigured or could not be initialized."""


@dataclass(frozen=True, eq=True)
class Cell:
    """A cell of the Sentry platform, hosted by a region silo."""

    name: str
    """The cell's unique identifier."""

    snowflake_id: int
    """The cell's unique numeric representation for composing "snowflake" IDs.

    Avoid using this in any context other than creating a new snowflake ID. Prefer
    the name as the cell's unique identifier. Snowflake IDs need to remain mutually
    unique only within the same timestamp, so the meaning of a number may not be
    stable over time if we ever choose to reassign or reuse the values.

    The number must fit inside the maximum bit length specified by our snowflake ID
    schema.
    """

    address: str
    """The address of the cell's silo.

    Represent a cell's hostname or IP address on the non-public network. This address
    is used for RPC routing.

    (e.g., "https://de.internal.getsentry.net" or https://10.21.99.10), and addresses
    such as "http://localhost:8001" in a dev environment.

    The customer facing address for a cell is derived from a cell's name
    and `system.region-api-url-template`
    """

    # TODO(cells): drop once category is fully moved to Locality
    category: RegionCategory

    visible: bool = True
    """Whether the cell is visible in API responses"""

    def validate(self) -> None:
        from sentry.utils.snowflake import REGION_ID

        REGION_ID.validate(self.snowflake_id)

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


class CellResolutionError(Exception):
    """Indicate that a cell's identity could not be resolved."""


class CellMappingNotFound(CellResolutionError):
    """Indicate that a mapping to a cell could not be found."""


class CellContextError(Exception):
    """Indicate that the server is not in a state to resolve a cell."""


class CellDirectory:
    """A set of cells in a Sentry environment.

    This is a singleton class. It is immutable in a production environment,
    but affords overrides by the subclass TestEnvRegionDirectory.
    """

    def __init__(
        self,
        cells: Collection[Cell],
        localities: Collection[Locality],
    ) -> None:
        self._cells = frozenset(cells)
        self._by_name = {r.name: r for r in self._cells}
        self._localities = frozenset(localities)
        self._localities_by_name = {loc.name: loc for loc in self._localities}
        self._cell_to_locality = {cell_name: loc for loc in localities for cell_name in loc.cells}

    @property
    def cells(self) -> frozenset[Cell]:
        return self._cells

    @property
    def localities(self) -> frozenset[Locality]:
        return self._localities

    def get_cell_by_name(self, cell_name: str) -> Cell | None:
        return self._by_name.get(cell_name)

    def get_locality_by_name(self, locality_name: str) -> Locality | None:
        return self._localities_by_name.get(locality_name)

    def get_cells(self, category: RegionCategory | None = None) -> Iterable[Cell]:
        if category is None:
            return iter(self._cells)

        return (
            r
            for r in self._cells
            if (loc := self._cell_to_locality.get(r.name)) is not None and loc.category == category
        )

    def get_cell_names(self, category: RegionCategory | None = None) -> Iterable[str]:
        return (r.name for r in self.get_cells(category))

    def get_locality_for_cell(self, cell_name: str) -> Locality | None:
        return self._cell_to_locality.get(cell_name)

    def get_cells_for_locality(self, locality_name: str) -> Iterable[Cell]:
        loc = self._localities_by_name.get(locality_name)
        if loc is None:
            return ()
        return (r for name in loc.cells if (r := self._by_name.get(name)) is not None)

    def validate_all(self) -> None:
        for cell in self.cells:
            cell.validate()

        # Ensure that a cell cannot be registered to more than one locality
        all_cell_refs = [cell_name for loc in self.localities for cell_name in loc.cells]
        assigned_cells = set(all_cell_refs)
        defined_cells = set(self._by_name.keys())

        if len(all_cell_refs) != len(assigned_cells):
            duplicates = {c for c in all_cell_refs if all_cell_refs.count(c) > 1}
            raise CellConfigurationError(
                f"Cells assigned to more than one locality: {duplicates!r}"
            )

        # Ensure that all cells are assigned to a locality, and that all localities only reference defined cells
        if assigned_cells != defined_cells:
            raise CellConfigurationError(
                f"Cells in locality config do not match cell config: "
                f"locality-only={assigned_cells - defined_cells!r}, "
                f"cell-only={defined_cells - assigned_cells!r}"
            )


def _parse_raw_config(cell_config: list[CellConfig]) -> Iterable[Cell]:
    for config_value in cell_config:
        yield Cell(
            name=config_value["name"],
            snowflake_id=config_value["snowflake_id"],
            category=RegionCategory(config_value["category"]),
            address=config_value["address"],
            visible=config_value.get("visible", True),
        )


def _generate_monolith_cell_if_needed(cells: Collection[Cell]) -> Iterable[Cell]:
    """Check whether a default monolith cell must be generated.

    Check the provided set of cells to see whether a cell with the configured
    name is present. If so, return an empty iterator. Else, yield the newly generated
    cell.
    """
    if not settings.SENTRY_MONOLITH_REGION:
        raise CellConfigurationError("`SENTRY_MONOLITH_REGION` must provide a default cell name")
    if not cells:
        yield Cell(
            name=settings.SENTRY_MONOLITH_REGION,
            snowflake_id=0,
            address=options.get("system.url-prefix"),
            category=RegionCategory.MULTI_TENANT,
        )
    elif not any(r.name == settings.SENTRY_MONOLITH_REGION for r in cells):
        raise CellConfigurationError(
            "The SENTRY_MONOLITH_REGION setting must point to a cell name "
            f"({settings.SENTRY_MONOLITH_REGION=!r}; "
            f"cell names = {[r.name for r in cells]!r})"
        )


def _parse_locality_config(
    locality_config: list[LocalityConfig],
) -> Iterable[Locality]:
    for config_value in locality_config:
        yield Locality(
            name=config_value["name"],
            category=RegionCategory(config_value["category"]),
            cells=frozenset(config_value["cells"]),
            visible=bool(config_value.get("visible", True)),
        )


def load_from_config(
    region_config: list[CellConfig],
    locality_config: list[LocalityConfig],
) -> CellDirectory:
    try:
        cells = set(_parse_raw_config(region_config))
        cells |= set(_generate_monolith_cell_if_needed(cells))
        localities = set(_parse_locality_config(locality_config))

        if not locality_config:
            # TODO(cells): If no locality config present — create a synthetic 1:1 locality per cell
            # as a temporary fallback. Once SENTRY_LOCALITIES is configured, all cells
            # must be explicitly assigned; missing cells will have no locality mapping.
            for cell in cells:
                localities.add(
                    Locality(
                        name=cell.name,
                        category=cell.category,
                        cells=frozenset([cell.name]),
                        visible=cell.visible,
                    )
                )

        return CellDirectory(cells, localities)
    except CellConfigurationError as e:
        sentry_sdk.capture_exception(e)
        raise
    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise CellConfigurationError("Unable to parse region_config.") from e


_global_directory: CellDirectory | None = None


def set_global_directory(directory: CellDirectory) -> None:
    if not in_test_environment():
        raise Exception(
            "The cell directory can be set directly only in a test environment. "
            "Otherwise, it should be automatically loaded from config when "
            "get_global_directory is first called."
        )
    global _global_directory
    _global_directory = directory


def get_global_directory() -> CellDirectory:
    global _global_directory
    if _global_directory is not None:
        return _global_directory

    from django.conf import settings

    # For now, assume that all cell configs can be taken in through Django
    # settings. We may investigate other ways of delivering those configs in
    # production.
    _global_directory = load_from_config(settings.SENTRY_REGION_CONFIG, settings.SENTRY_LOCALITIES)
    return _global_directory


def get_cell_by_name(name: str) -> Cell:
    """Look up a cell by name."""
    cell_regions = get_global_directory()
    cell = cell_regions.get_cell_by_name(name)
    if cell is not None:
        return cell
    else:
        cell_names = list(cell_regions.get_cell_names(RegionCategory.MULTI_TENANT))
        raise CellResolutionError(
            f"No cell with name: {name!r} (expected one of {cell_names!r} or a single-tenant name)"
        )


def get_locality_by_name(name: str) -> Locality:
    """Look up a locality by name."""
    global_directory = get_global_directory()
    locality = global_directory.get_locality_by_name(name)
    if locality is not None:
        return locality
    else:
        locality_names = [loc.name for loc in global_directory.localities]
        raise CellResolutionError(
            f"No locality with name: {name!r} (expected one of {locality_names!r})"
        )


def subdomain_is_locality(request: HttpRequest) -> bool:
    """Check whether the request's subdomain is a locality name.

    Locality subdomains (e.g. "us.sentry.io", "de.sentry.io") are reserved for
    infrastructure routing and must not be treated as organization slugs. Returns
    False when there is no subdomain or when it does not match any known locality.
    """
    subdomain = getattr(request, "subdomain", None)
    if subdomain is None:
        return False
    return get_global_directory().get_locality_by_name(subdomain) is not None


@control_silo_function
def get_cell_for_organization(organization_id_or_slug: str) -> Cell:
    """Resolve an organization to the cell where its data is stored."""
    from sentry.models.organizationmapping import OrganizationMapping

    if organization_id_or_slug.isdecimal():
        mapping = OrganizationMapping.objects.filter(
            organization_id=organization_id_or_slug
        ).first()
    else:
        mapping = OrganizationMapping.objects.filter(slug=organization_id_or_slug).first()

    if not mapping:
        raise CellResolutionError(
            f"Organization {organization_id_or_slug} has no associated mapping."
        )

    return get_cell_by_name(name=mapping.cell_name)


# TOOD(cells): Remove alias once getsentry import sites are updated
get_region_for_organization = get_cell_for_organization


def get_local_locality() -> Locality:
    """Get the locality for the cell this server instance is running in."""
    cell = get_local_cell()
    locality = get_global_directory().get_locality_for_cell(cell.name)
    if locality is None:
        raise CellResolutionError(f"No locality found for cell {cell.name!r}")
    return locality


def get_locality_name_for_cell(cell_name: str) -> str:
    """
    Get the locality name for a cell
    """
    locality = get_global_directory().get_locality_for_cell(cell_name)
    if locality is None:
        raise CellResolutionError(f"No locality found for cell {cell_name!r}")

    return locality.name


def get_local_cell() -> Cell:
    """Get the cell in which this server instance is running.

    Return the monolith cell if this server instance is in monolith mode.
    Otherwise, it must be a cell silo; raise CellContextError otherwise.
    """

    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return get_cell_by_name(settings.SENTRY_MONOLITH_REGION)

    if SiloMode.get_current_mode() != SiloMode.CELL:
        raise CellContextError("Not a cell silo")

    # In our threaded acceptance tests, we need to override the region of the current
    # context when passing through test rpc calls, but we can't rely on settings because
    # django settings are not thread safe :'(
    # We use this thread local instead which is managed by the SiloMode context managers
    single_process_cell = SingleProcessSiloModeState.get_cell()
    if single_process_cell is not None:
        return single_process_cell

    if not settings.SENTRY_REGION:
        if in_test_environment():
            return get_cell_by_name(settings.SENTRY_MONOLITH_REGION)
        else:
            raise Exception("SENTRY_REGION must be set when server is in REGION silo mode")
    return get_cell_by_name(settings.SENTRY_REGION)


@control_silo_function
def _find_orgs_for_user(user_id: int) -> set[int]:
    from sentry.models.organizationmembermapping import OrganizationMemberMapping

    return {
        m["organization_id"]
        for m in OrganizationMemberMapping.objects.filter(user_id=user_id).values("organization_id")
    }


@control_silo_function
def find_cells_for_orgs(org_ids: Iterable[int]) -> set[str]:
    from sentry.models.organizationmapping import OrganizationMapping

    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return {settings.SENTRY_MONOLITH_REGION}
    else:
        return set(
            OrganizationMapping.objects.filter(organization_id__in=org_ids).values_list(
                "cell_name", flat=True
            )
        )


@control_silo_function
def find_cells_for_user(user_id: int) -> set[str]:
    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return {settings.SENTRY_MONOLITH_REGION}

    org_ids = _find_orgs_for_user(user_id)
    return find_cells_for_orgs(org_ids)


@control_silo_function
def find_cells_for_sentry_app(sentry_app: SentryApp) -> set[str]:
    from sentry.models.organizationmapping import OrganizationMapping
    from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation

    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return {settings.SENTRY_MONOLITH_REGION}

    organizations_with_installations = SentryAppInstallation.objects.filter(
        sentry_app=sentry_app
    ).values_list("organization_id")
    cells = (
        OrganizationMapping.objects.filter(organization_id__in=organizations_with_installations)
        .distinct("cell_name")
        .values_list("cell_name")
    )
    return {c[0] for c in cells}


def find_all_cell_names() -> Iterable[str]:
    return get_global_directory().get_cell_names()


def find_all_multitenant_cell_names() -> list[str]:
    """
    Return all visible multi_tenant cells.
    """
    cells = get_global_directory().get_cells(RegionCategory.MULTI_TENANT)
    return list([c.name for c in cells if c.visible])


def find_all_multitenant_locality_names() -> list[str]:
    """
    Return all visible multi-tenant localities.
    """
    return [
        loc.name
        for loc in get_global_directory().localities
        if loc.category == RegionCategory.MULTI_TENANT and loc.visible
    ]
