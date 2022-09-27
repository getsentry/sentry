import pytest
from django.test import override_settings

from sentry.silo import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.region import override_regions
from sentry.types.region import (
    Region,
    RegionCategory,
    RegionContextError,
    RegionResolutionError,
    get_local_region,
    get_region_by_id,
    get_region_by_name,
    get_region_for_organization,
)


class RegionMappingTest(TestCase):
    def test_region_mapping(self):
        regions = [
            Region("north_america", 1, "na.sentry.io", RegionCategory.MULTI_TENANT),
            Region("europe", 2, "eu.sentry.io", RegionCategory.MULTI_TENANT),
            Region("acme-single-tenant", 3, "acme.my.sentry.io", RegionCategory.SINGLE_TENANT),
        ]
        with override_regions(regions):
            assert get_region_by_id(1) == regions[0]
            assert get_region_by_name("europe") == regions[1]

            with pytest.raises(RegionResolutionError):
                get_region_by_id(4)
            with pytest.raises(RegionResolutionError):
                get_region_by_name("nowhere")

    def test_get_for_organization(self):
        with override_regions(()):
            org = self.create_organization()
            with pytest.raises(RegionContextError):
                get_region_for_organization(org)

    def test_get_local_region(self):
        regions = [
            Region("north_america", 1, "na.sentry.io", RegionCategory.MULTI_TENANT),
            Region("europe", 2, "eu.sentry.io", RegionCategory.MULTI_TENANT),
        ]

        with override_regions(regions):
            with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="north_america"):
                assert get_local_region() == regions[0]

            with override_settings(SILO_MODE=SiloMode.MONOLITH):
                with pytest.raises(RegionContextError):
                    get_local_region()
