from unittest.mock import patch

import pytest
from django.conf import settings
from django.db import router
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

            with override_settings(SILO_MODE=SiloMode.MONOLITH):
                # The relative address and the 0 id are the only important parts of this region value
                assert get_local_region() == Region(
                    settings.SENTRY_MONOLITH_REGION,
                    0,
                    "http://testserver",
                    RegionCategory.MULTI_TENANT,
                )

    def test_get_region_for_organization(self):
        clear_global_regions()
        regions = [
            Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT),
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
        with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="na"):
            valid_region = Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT)
            valid_region.validate()

    def test_region_to_url(self):
        region = Region("na", 1, "http://192.168.1.99", RegionCategory.MULTI_TENANT)
        assert region.to_url("/avatar/abcdef/") == "http://na.testserver/avatar/abcdef/"

    def test_json_config_injection(self):
        clear_global_regions()
        region_config = [
            {
                "name": "na",
                "snowflake_id": 1,
                "address": "http://na.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
            }
        ]
        with override_settings(SENTRY_REGION_CONFIG=json.dumps(region_config)):
            region = get_region_by_name("na")
        assert region.snowflake_id == 1

    @patch("sentry.types.region.sentry_sdk")
    def test_invalid_config(self, sentry_sdk_mock):
        clear_global_regions()
        region_config = ["invalid"]
        assert sentry_sdk_mock.capture_exception.call_count == 0
        with override_settings(SENTRY_REGION_CONFIG=json.dumps(region_config)), pytest.raises(
            RegionConfigurationError
        ):
            get_region_by_name("na")
        assert sentry_sdk_mock.capture_exception.call_count == 1

    def test_find_regions_for_user(self):
        from sentry.types.region import find_regions_for_user

        organization = self.create_organization(name="test name")
        organization_mapping = OrganizationMapping.objects.get(organization_id=organization.id)
        organization_mapping.name = "test name"
        organization_mapping.region_name = "na"
        organization_mapping.idempotency_key = "test"

        with unguarded_write(using=router.db_for_write(OrganizationMapping)):
            organization_mapping.save()

        region_config = [
            {
                "name": "na",
                "snowflake_id": 1,
                "address": "http://na.testserver",
                "category": RegionCategory.MULTI_TENANT.name,
            }
        ]
        with override_settings(
            SILO_MODE=SiloMode.CONTROL, SENTRY_REGION_CONFIG=json.dumps(region_config)
        ):
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
