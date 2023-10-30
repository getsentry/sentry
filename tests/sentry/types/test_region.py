from unittest.mock import patch

import pytest
from django.conf import settings
from django.db import router
from django.test import override_settings

from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.silo import SiloLimit, SiloMode, unguarded_write
from sentry.testutils.cases import TestCase
from sentry.testutils.region import override_region_config, override_regions
from sentry.types.region import (
    Region,
    RegionCategory,
    RegionConfigurationError,
    RegionResolutionError,
    clear_global_regions,
    find_all_multitenant_region_names,
    find_all_region_names,
    get_local_region,
    get_region_by_name,
    get_region_for_organization,
)
from sentry.utils import json


class RegionMappingTest(TestCase):
    def setUp(self) -> None:
        clear_global_regions()

    def test_region_mapping(self):
        regions = [
            Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT),
            Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
            Region("acme-single-tenant", 3, "acme.my.sentry.io", RegionCategory.SINGLE_TENANT),
        ]
        with override_regions(regions):
            assert get_region_by_name("eu") == regions[1]

            with pytest.raises(RegionResolutionError):
                get_region_by_name("nowhere")

    def test_get_local_region(self):
        regions = [
            Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT),
            Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
        ]

        with override_regions(regions):
            with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="us"):
                assert get_local_region() == regions[0]

        with override_regions(()):
            with override_settings(SILO_MODE=SiloMode.MONOLITH):
                # The relative address and the 0 id are the only important parts of this region value
                assert get_local_region() == Region(
                    settings.SENTRY_MONOLITH_REGION,
                    0,
                    "http://testserver",
                    RegionCategory.MULTI_TENANT,
                )

    def test_get_region_for_organization(self):
        regions = [
            Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT),
            Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
        ]
        mapping = OrganizationMapping.objects.get(slug=self.organization.slug)
        with override_regions(regions), unguarded_write(
            using=router.db_for_write(OrganizationMapping)
        ):
            mapping.update(region_name="az")
            with pytest.raises(RegionResolutionError):
                # Region does not exist
                get_region_for_organization(self.organization.slug)

            mapping.update(region_name=regions[0].name)
            region = get_region_for_organization(self.organization.slug)
            assert region == regions[0]

            mapping.update(region_name=regions[1].name)
            region = get_region_for_organization(self.organization.slug)
            assert region == regions[1]

            mapping.delete()
            with pytest.raises(RegionResolutionError):
                # OrganizationMapping does not exist
                get_region_for_organization(self.organization.slug)

    def test_validate_region(self):
        with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="us"):
            valid_region = Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT)
            valid_region.validate()

    def test_region_to_url(self):
        region = Region("us", 1, "http://192.168.1.99", RegionCategory.MULTI_TENANT)
        with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="us"):
            assert region.to_url("/avatar/abcdef/") == "http://us.testserver/avatar/abcdef/"
        with override_settings(SILO_MODE=SiloMode.CONTROL, SENTRY_REGION=""):
            assert region.to_url("/avatar/abcdef/") == "http://us.testserver/avatar/abcdef/"
        with override_settings(SILO_MODE=SiloMode.MONOLITH, SENTRY_REGION=""):
            assert region.to_url("/avatar/abcdef/") == "http://testserver/avatar/abcdef/"

    def test_json_config_injection(self):
        region_config = [
            {
                "name": "us",
                "snowflake_id": 1,
                "address": "http://us.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
            }
        ]
        with override_settings(
            SENTRY_REGION_CONFIG=json.dumps(region_config),
            SENTRY_MONOLITH_REGION="us",
        ):
            region = get_region_by_name("us")
        assert region.snowflake_id == 1

    @patch("sentry.types.region.sentry_sdk")
    def test_invalid_config(self, sentry_sdk_mock):
        region_config = ["invalid"]
        assert sentry_sdk_mock.capture_exception.call_count == 0
        with override_settings(SENTRY_REGION_CONFIG=json.dumps(region_config)), pytest.raises(
            RegionConfigurationError
        ):
            get_region_by_name("us")
        assert sentry_sdk_mock.capture_exception.call_count == 1

    def test_default_historic_region_setting(self):
        monolith_region_name = "my_default_historic_monolith_region"
        with override_settings(
            SENTRY_REGION_CONFIG=json.dumps([]),
            SENTRY_MONOLITH_REGION=monolith_region_name,
        ):
            region = get_region_by_name(monolith_region_name)
            assert region.name == monolith_region_name
            assert region.is_historic_monolith_region()

    def test_invalid_historic_region_setting(self):
        region_config = [
            {
                "name": "us",
                "snowflake_id": 1,
                "address": "http://us.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
            }
        ]
        with override_settings(
            SENTRY_REGION_CONFIG=json.dumps(region_config),
            SENTRY_MONOLITH_REGION="nonexistent",
        ):
            with pytest.raises(RegionConfigurationError):
                get_region_by_name("us")

    def test_find_regions_for_user(self):
        from sentry.types.region import find_regions_for_user

        region_config = [
            {
                "name": "us",
                "snowflake_id": 1,
                "address": "http://us.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
            }
        ]
        with override_settings(SILO_MODE=SiloMode.CONTROL), override_region_config(region_config):
            organization = self.create_organization(name="test name", region="us")

            user = self.create_user()
            organization_service.add_organization_member(
                organization_id=organization.id,
                default_org_role=organization.default_role,
                user_id=user.id,
            )
            actual_regions = find_regions_for_user(user_id=user.id)
            assert actual_regions == {"us"}

        with override_settings(SILO_MODE=SiloMode.REGION):
            with pytest.raises(SiloLimit.AvailabilityError):
                find_regions_for_user(user_id=user.id)

    def test_find_all_region_names(self):
        region_config = [
            {
                "name": "us",
                "snowflake_id": 1,
                "address": "http://us.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
            },
            {
                "name": "acme",
                "snowflake_id": 2,
                "address": "http://acme.testserver",
                "category": RegionCategory.SINGLE_TENANT.name,
            },
        ]
        with override_settings(SILO_MODE=SiloMode.CONTROL), override_region_config(region_config):
            result = find_all_region_names()
            assert set(result) == {"us", "acme"}

    def test_find_all_multitenant_region_names(self):
        region_config = [
            {
                "name": "us",
                "snowflake_id": 1,
                "address": "http://us.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
            },
            {
                "name": "acme",
                "snowflake_id": 2,
                "address": "http://acme.testserver",
                "category": RegionCategory.SINGLE_TENANT.name,
            },
        ]
        with override_settings(SILO_MODE=SiloMode.CONTROL), override_region_config(region_config):
            result = find_all_multitenant_region_names()
            assert set(result) == {"us"}
