from unittest.mock import patch

import pytest
from django.conf import settings
from django.test import override_settings

from sentry.models import OrganizationMapping
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.silo import SiloLimit, SiloMode, unguarded_write
from sentry.testutils import TestCase
from sentry.testutils.region import override_regions
from sentry.types.region import (
    Region,
    RegionCategory,
    RegionConfigurationError,
    RegionResolutionError,
    clear_global_regions,
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
            Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT),
            Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
            Region("acme-single-tenant", 3, "acme.my.sentry.io", RegionCategory.SINGLE_TENANT),
        ]
        with override_regions(regions):
            assert get_region_by_name("eu") == regions[1]

            with pytest.raises(RegionResolutionError):
                get_region_by_name("nowhere")

    def test_get_local_region(self):
        regions = [
            Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT),
            Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
        ]

        with override_regions(regions):
            with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="na"):
                assert get_local_region() == regions[0]

        with override_regions(()):
            with override_settings(SILO_MODE=SiloMode.MONOLITH):
                # The relative address and the 0 id are the only important parts of this region value
                assert get_local_region() == Region(
                    settings.SENTRY_MONOLITH_REGION, 0, "/", RegionCategory.MULTI_TENANT
                )

    def test_get_region_for_organization(self):
        regions = [
            Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT),
            Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
        ]
        mapping = OrganizationMapping.objects.get(slug=self.organization.slug)
        with override_regions(regions), unguarded_write():
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
        with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="na"):
            invalid_region = Region("na", 1, "na.sentry.io", RegionCategory.MULTI_TENANT)
            with pytest.raises(RegionConfigurationError):
                invalid_region.validate()
            valid_region = Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT)
            valid_region.validate()

    def test_json_config_injection(self):
        region_config = [
            {
                "name": "na",
                "snowflake_id": 1,
                "address": "http://na.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
            }
        ]
        with override_settings(
            SENTRY_REGION_CONFIG=json.dumps(region_config),
            SENTRY_MONOLITH_REGION="na",
        ):
            region = get_region_by_name("na")
        assert region.snowflake_id == 1

    @patch("sentry.types.region.sentry_sdk")
    def test_invalid_config(self, sentry_sdk_mock):
        region_config = ["invalid"]
        assert sentry_sdk_mock.capture_exception.call_count == 0
        with override_settings(SENTRY_REGION_CONFIG=json.dumps(region_config)), pytest.raises(
            RegionConfigurationError
        ):
            get_region_by_name("na")
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
                "name": "na",
                "snowflake_id": 1,
                "address": "http://na.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
            }
        ]
        with override_settings(
            SENTRY_REGION_CONFIG=json.dumps(region_config),
            SENTRY_MONOLITH_REGION="nonexistent",
        ):
            with pytest.raises(RegionConfigurationError):
                get_region_by_name("na")

    def test_find_regions_for_user(self):
        from sentry.types.region import find_regions_for_user

        region_config = [
            {
                "name": "na",
                "snowflake_id": 1,
                "address": "http://na.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
            }
        ]
        with override_settings(
            SILO_MODE=SiloMode.CONTROL,
            SENTRY_REGION_CONFIG=json.dumps(region_config),
            SENTRY_MONOLITH_REGION="na",
        ):
            organization = self.create_organization(name="test name")
            organization_mapping = OrganizationMapping.objects.get(organization_id=organization.id)
            organization_mapping.name = "test name"
            organization_mapping.region_name = "na"
            organization_mapping.idempotency_key = "test"

            with unguarded_write():
                organization_mapping.save()

            user = self.create_user()
            organization_service.add_organization_member(
                organization_id=organization.id,
                default_org_role=organization.default_role,
                user_id=user.id,
            )
            actual_regions = find_regions_for_user(user_id=user.id)
            assert actual_regions == {"na"}

        with override_settings(SILO_MODE=SiloMode.REGION):
            with pytest.raises(SiloLimit.AvailabilityError):
                find_regions_for_user(user_id=user.id)
