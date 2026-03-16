from collections.abc import Generator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from django.db import router
from django.test import RequestFactory, override_settings

from sentry.conf.types.region_config import CellConfig
from sentry.models.organizationmapping import OrganizationMapping
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloLimit, SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestCase
from sentry.testutils.region import get_test_env_directory
from sentry.types.cell import (
    Cell,
    CellConfigurationError,
    CellDirectory,
    CellResolutionError,
    Locality,
    RegionCategory,
    find_all_cell_names,
    find_all_multitenant_cell_names,
    find_cells_for_sentry_app,
    find_cells_for_user,
    get_cell_by_name,
    get_cell_for_organization,
    get_local_cell,
    load_from_config,
    subdomain_is_locality,
)


class CellDirectoryTest(TestCase):
    """Test cell config parsing and setup.

    Note: Because this test case is targeted at the logic of setting up the
    CellDirectory, it uses a lot of `override_settings` in ways that most test
    cases shouldn't. If you are having difficulty with cell setup in other test
    cases, please don't follow this class as an example, but instead use the
    utilities in testutils/silo.py and testutils/region.py.
    """

    _INPUTS: list[CellConfig] = [
        {
            "name": "us",
            "snowflake_id": 1,
            "address": "http://us.testserver",
            "category": RegionCategory.MULTI_TENANT.name,
        },
        {
            "name": "eu",
            "snowflake_id": 2,
            "address": "http://eu.testserver",
            "category": RegionCategory.MULTI_TENANT.name,
        },
        {
            "name": "acme",
            "snowflake_id": 3,
            "address": "http://acme.testserver",
            "category": RegionCategory.SINGLE_TENANT.name,
        },
    ]

    _EXPECTED_OUTPUTS = (
        Cell("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT),
        Cell("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
        Cell("acme", 3, "http://acme.testserver", RegionCategory.SINGLE_TENANT),
    )

    @staticmethod
    @contextmanager
    def _in_global_state(directory: CellDirectory) -> Generator[None]:
        with get_test_env_directory().swap_state(tuple(directory.cells)):
            yield

    def test_cell_config_parsing_in_monolith(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS, [])
        assert directory.cells == frozenset(self._EXPECTED_OUTPUTS)
        assert directory.get_cell_by_name("nowhere") is None

        with self._in_global_state(directory):
            assert get_cell_by_name("eu") == self._EXPECTED_OUTPUTS[1]

            with pytest.raises(CellResolutionError):
                get_cell_by_name("nowhere")

    def test_cell_config_parsing_in_control(self) -> None:
        with (
            override_settings(SILO_MODE=SiloMode.CONTROL),
            override_settings(SENTRY_MONOLITH_REGION="us"),
        ):
            directory = load_from_config(self._INPUTS, [])
        assert directory.cells == frozenset(self._EXPECTED_OUTPUTS)

    @override_settings(SILO_MODE=SiloMode.CELL, SENTRY_REGION="us")
    def test_get_local_cell(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS, [])
        with self._in_global_state(directory):
            assert get_local_cell() == self._EXPECTED_OUTPUTS[0]

    def test_get_generated_monolith_cell(self) -> None:
        with (
            override_settings(SILO_MODE=SiloMode.MONOLITH, SENTRY_MONOLITH_REGION="defaultland"),
            self._in_global_state(load_from_config([], [])),
        ):
            local_cell = get_local_cell()
            assert local_cell.name == "defaultland"
            assert local_cell.snowflake_id == 0
            assert local_cell.category == RegionCategory.MULTI_TENANT

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @unguarded_write(using=router.db_for_write(OrganizationMapping))
    def test_get_cell_for_organization(self) -> None:
        mapping = OrganizationMapping.objects.get(slug=self.organization.slug)
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS, [])
        with self._in_global_state(directory):
            mapping.update(cell_name="az")
            with pytest.raises(CellResolutionError):
                # Cell does not exist
                get_cell_for_organization(self.organization.slug)

            mapping.update(cell_name=self._EXPECTED_OUTPUTS[0].name)
            cell = get_cell_for_organization(self.organization.slug)
            assert cell == self._EXPECTED_OUTPUTS[0]

            mapping.update(cell_name=self._EXPECTED_OUTPUTS[1].name)
            cell = get_cell_for_organization(self.organization.slug)
            assert cell == self._EXPECTED_OUTPUTS[1]

            mapping.delete()
            with pytest.raises(CellResolutionError):
                # OrganizationMapping does not exist
                get_cell_for_organization(self.organization.slug)

    def test_validate_cell(self) -> None:
        for cell in self._EXPECTED_OUTPUTS:
            cell.validate()

    def test_locality_to_url(self) -> None:
        locality = Locality("us", frozenset(["us"]), RegionCategory.MULTI_TENANT)
        with override_settings(SILO_MODE=SiloMode.CELL, SENTRY_REGION="us"):
            assert locality.to_url("/avatar/abcdef/") == "http://us.testserver/avatar/abcdef/"
        with override_settings(SILO_MODE=SiloMode.CONTROL, SENTRY_REGION=""):
            assert locality.to_url("/avatar/abcdef/") == "http://us.testserver/avatar/abcdef/"
        with override_settings(SILO_MODE=SiloMode.MONOLITH, SENTRY_REGION=""):
            assert locality.to_url("/avatar/abcdef/") == "http://testserver/avatar/abcdef/"

    @patch("sentry.types.region.sentry_sdk")
    def test_invalid_config(self, sentry_sdk_mock: MagicMock) -> None:
        assert sentry_sdk_mock.capture_exception.call_count == 0
        with pytest.raises(CellConfigurationError):
            load_from_config(["invalid"], [])  # type: ignore[list-item]
        assert sentry_sdk_mock.capture_exception.call_count == 1

    def test_invalid_historic_cell_setting(self) -> None:
        with pytest.raises(CellConfigurationError):
            with override_settings(SENTRY_MONOLITH_REGION="nonexistent"):
                load_from_config(self._INPUTS, [])

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_find_cells_for_user(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS, [])
        with self._in_global_state(directory):
            organization = self.create_organization(name="test name", region="us")

            user = self.create_user()
            organization_service.add_organization_member(
                organization_id=organization.id,
                default_org_role=organization.default_role,
                user_id=user.id,
            )
            actual_cells = find_cells_for_user(user_id=user.id)
            assert actual_cells == {"us"}

        with (
            override_settings(SILO_MODE=SiloMode.CELL),
            pytest.raises(SiloLimit.AvailabilityError),
        ):
            find_cells_for_user(user_id=user.id)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_find_cells_for_sentry_app(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS, [])
        with self._in_global_state(directory):
            us_org_1 = self.create_organization(name="us test name 1", region="us")
            us_org_2 = self.create_organization(name="us test name 2", region="us")

            sentry_app = self.create_sentry_app(
                organization=self.organization,
                scopes=["project:write"],
            )
            actual_cells = find_cells_for_sentry_app(sentry_app=sentry_app)
            assert actual_cells == set()

            self.create_sentry_app_installation(slug=sentry_app.slug, organization=us_org_1)
            self.create_sentry_app_installation(slug=sentry_app.slug, organization=us_org_2)
            actual_cells = find_cells_for_sentry_app(sentry_app=sentry_app)
            assert actual_cells == {"us"}

            eu_org_1 = self.create_organization(name="eu test name", region="eu")
            eu_org_2 = self.create_organization(name="eu test name", region="eu")
            self.create_sentry_app_installation(slug=sentry_app.slug, organization=eu_org_1)
            self.create_sentry_app_installation(slug=sentry_app.slug, organization=eu_org_2)
            actual_cells = find_cells_for_sentry_app(sentry_app=sentry_app)
            assert actual_cells == {"us", "eu"}

        with (
            override_settings(SILO_MODE=SiloMode.CELL),
            pytest.raises(SiloLimit.AvailabilityError),
        ):
            find_cells_for_sentry_app(sentry_app=sentry_app)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_find_all_cell_names(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS, [])
        with self._in_global_state(directory):
            result = find_all_cell_names()
            assert set(result) == {"us", "eu", "acme"}

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_find_all_multitenant_cell_names(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS, [])
        with self._in_global_state(directory):
            result = find_all_multitenant_cell_names()
            assert set(result) == {"us", "eu"}

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_find_all_multitenant_cell_names_non_visible(self) -> None:
        inputs: list[CellConfig] = [
            *self._INPUTS,
            {
                "name": "ja",
                "snowflake_id": 4,
                "address": "https://ja.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
                "visible": False,
            },
        ]
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(inputs, [])
        with self._in_global_state(directory):
            result = find_all_multitenant_cell_names()
            assert set(result) == {"us", "eu"}

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_subdomain_is_locality(self) -> None:
        cells: list[CellConfig] = [
            {
                "name": "us",
                "snowflake_id": 1,
                "address": "https://us.testserver",
                "category": "MULTI_TENANT",
            },
        ]
        rf = RequestFactory()
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(cells, [])
        with self._in_global_state(directory):
            req = rf.get("/")
            setattr(req, "subdomain", "us")
            assert subdomain_is_locality(req)

            req = rf.get("/")
            setattr(req, "subdomain", "acme")
            assert not subdomain_is_locality(req)
