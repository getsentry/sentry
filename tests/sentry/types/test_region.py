from collections.abc import Generator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from django.db import router
from django.test import RequestFactory, override_settings

from sentry.models.organizationmapping import OrganizationMapping
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloLimit, SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestCase
from sentry.testutils.region import get_test_env_directory
from sentry.types.region import (
    Region,
    RegionCategory,
    RegionConfigurationError,
    RegionDirectory,
    RegionResolutionError,
    find_all_multitenant_region_names,
    find_all_region_names,
    find_regions_for_sentry_app,
    find_regions_for_user,
    get_local_region,
    get_region_by_name,
    get_region_for_organization,
    load_from_config,
    subdomain_is_region,
)
from sentry.utils import json


class RegionDirectoryTest(TestCase):
    """Test region config parsing and setup.

    Note: Because this test case is targeted at the logic of setting up the
    RegionDirectory, it uses a lot of `override_settings` in ways that most test
    cases shouldn't. If you are having difficulty with region setup in other test
    cases, please don't follow this class as an example, but instead use the
    utilities in testutils/silo.py and testutils/region.py.
    """

    _INPUTS = (
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
    )

    _EXPECTED_OUTPUTS = (
        Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT),
        Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
        Region("acme", 3, "http://acme.testserver", RegionCategory.SINGLE_TENANT),
    )

    @staticmethod
    @contextmanager
    def _in_global_state(directory: RegionDirectory) -> Generator[None]:
        with get_test_env_directory().swap_state(tuple(directory.regions)):
            yield

    def test_region_config_parsing_in_monolith(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS)
        assert directory.regions == frozenset(self._EXPECTED_OUTPUTS)
        assert directory.get_by_name("nowhere") is None

        with self._in_global_state(directory):
            assert get_region_by_name("eu") == self._EXPECTED_OUTPUTS[1]

            with pytest.raises(RegionResolutionError):
                get_region_by_name("nowhere")

    def test_region_config_parsing_in_control(self) -> None:
        with (
            override_settings(SILO_MODE=SiloMode.CONTROL),
            override_settings(SENTRY_MONOLITH_REGION="us"),
        ):
            directory = load_from_config(self._INPUTS)
        assert directory.regions == frozenset(self._EXPECTED_OUTPUTS)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_json_config_injection(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(json.dumps(self._INPUTS))
        assert directory.regions == frozenset(self._EXPECTED_OUTPUTS)

    @override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="us")
    def test_get_local_region(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS)
        with self._in_global_state(directory):
            assert get_local_region() == self._EXPECTED_OUTPUTS[0]

    def test_get_generated_monolith_region(self) -> None:
        with (
            override_settings(SILO_MODE=SiloMode.MONOLITH, SENTRY_MONOLITH_REGION="defaultland"),
            self._in_global_state(load_from_config(())),
        ):
            local_region = get_local_region()
            assert local_region.name == "defaultland"
            assert local_region.snowflake_id == 0
            assert local_region.category == RegionCategory.MULTI_TENANT

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @unguarded_write(using=router.db_for_write(OrganizationMapping))
    def test_get_region_for_organization(self) -> None:
        mapping = OrganizationMapping.objects.get(slug=self.organization.slug)
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS)
        with self._in_global_state(directory):
            mapping.update(region_name="az")
            with pytest.raises(RegionResolutionError):
                # Region does not exist
                get_region_for_organization(self.organization.slug)

            mapping.update(region_name=self._EXPECTED_OUTPUTS[0].name)
            region = get_region_for_organization(self.organization.slug)
            assert region == self._EXPECTED_OUTPUTS[0]

            mapping.update(region_name=self._EXPECTED_OUTPUTS[1].name)
            region = get_region_for_organization(self.organization.slug)
            assert region == self._EXPECTED_OUTPUTS[1]

            mapping.delete()
            with pytest.raises(RegionResolutionError):
                # OrganizationMapping does not exist
                get_region_for_organization(self.organization.slug)

    def test_validate_region(self) -> None:
        for region in self._EXPECTED_OUTPUTS:
            region.validate()

    def test_region_to_url(self) -> None:
        region = Region("us", 1, "http://192.168.1.99", RegionCategory.MULTI_TENANT)
        with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="us"):
            assert region.to_url("/avatar/abcdef/") == "http://us.testserver/avatar/abcdef/"
        with override_settings(SILO_MODE=SiloMode.CONTROL, SENTRY_REGION=""):
            assert region.to_url("/avatar/abcdef/") == "http://us.testserver/avatar/abcdef/"
        with override_settings(SILO_MODE=SiloMode.MONOLITH, SENTRY_REGION=""):
            assert region.to_url("/avatar/abcdef/") == "http://testserver/avatar/abcdef/"

    @patch("sentry.types.region.sentry_sdk")
    def test_invalid_config(self, sentry_sdk_mock: MagicMock) -> None:
        region_config = ["invalid"]
        assert sentry_sdk_mock.capture_exception.call_count == 0
        with pytest.raises(RegionConfigurationError):
            load_from_config(region_config)
        assert sentry_sdk_mock.capture_exception.call_count == 1

    def test_invalid_historic_region_setting(self) -> None:
        with pytest.raises(RegionConfigurationError):
            with override_settings(SENTRY_MONOLITH_REGION="nonexistent"):
                load_from_config(self._INPUTS)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_find_regions_for_user(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS)
        with self._in_global_state(directory):
            organization = self.create_organization(name="test name", region="us")

            user = self.create_user()
            organization_service.add_organization_member(
                organization_id=organization.id,
                default_org_role=organization.default_role,
                user_id=user.id,
            )
            actual_regions = find_regions_for_user(user_id=user.id)
            assert actual_regions == {"us"}

        with (
            override_settings(SILO_MODE=SiloMode.REGION),
            pytest.raises(SiloLimit.AvailabilityError),
        ):
            find_regions_for_user(user_id=user.id)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_find_regions_for_sentry_app(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS)
        with self._in_global_state(directory):
            us_org_1 = self.create_organization(name="us test name 1", region="us")
            us_org_2 = self.create_organization(name="us test name 2", region="us")

            sentry_app = self.create_sentry_app(
                organization=self.organization,
                scopes=["project:write"],
            )
            actual_regions = find_regions_for_sentry_app(sentry_app=sentry_app)
            assert actual_regions == set()

            self.create_sentry_app_installation(slug=sentry_app.slug, organization=us_org_1)
            self.create_sentry_app_installation(slug=sentry_app.slug, organization=us_org_2)
            actual_regions = find_regions_for_sentry_app(sentry_app=sentry_app)
            assert actual_regions == {"us"}

            eu_org_1 = self.create_organization(name="eu test name", region="eu")
            eu_org_2 = self.create_organization(name="eu test name", region="eu")
            self.create_sentry_app_installation(slug=sentry_app.slug, organization=eu_org_1)
            self.create_sentry_app_installation(slug=sentry_app.slug, organization=eu_org_2)
            actual_regions = find_regions_for_sentry_app(sentry_app=sentry_app)
            assert actual_regions == {"us", "eu"}

        with (
            override_settings(SILO_MODE=SiloMode.REGION),
            pytest.raises(SiloLimit.AvailabilityError),
        ):
            find_regions_for_sentry_app(sentry_app=sentry_app)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_find_all_region_names(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS)
        with self._in_global_state(directory):
            result = find_all_region_names()
            assert set(result) == {"us", "eu", "acme"}

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_find_all_multitenant_region_names(self) -> None:
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(self._INPUTS)
        with self._in_global_state(directory):
            result = find_all_multitenant_region_names()
            assert set(result) == {"us", "eu"}

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_find_all_multitenant_region_names_non_visible(self) -> None:
        inputs = [
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
            directory = load_from_config(inputs)
        with self._in_global_state(directory):
            result = find_all_multitenant_region_names()
            assert set(result) == {"us", "eu"}

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_subdomain_is_region(self) -> None:
        regions = [
            Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT),
        ]
        rf = RequestFactory()
        with override_settings(SENTRY_MONOLITH_REGION="us"):
            directory = load_from_config(regions)
        with self._in_global_state(directory):
            req = rf.get("/")
            setattr(req, "subdomain", "us")
            assert subdomain_is_region(req)

            req = rf.get("/")
            setattr(req, "subdomain", "acme")
            assert not subdomain_is_region(req)
