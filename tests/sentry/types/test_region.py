import pytest
from django.test import override_settings

from sentry.silo import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.region import override_regions
from sentry.types.region import (
    MONOLITH_REGION_NAME,
    Region,
    RegionCategory,
    RegionConfigurationError,
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
            Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT),
            Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
            Region("acme-single-tenant", 3, "acme.my.sentry.io", RegionCategory.SINGLE_TENANT),
        ]
        with override_regions(regions):
            assert get_region_by_id(1) == regions[0]
            assert get_region_by_name("eu") == regions[1]

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
            Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT),
            Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
        ]

        with override_regions(regions):
            with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="na"):
                assert get_local_region() == regions[0]

            with override_settings(SILO_MODE=SiloMode.MONOLITH):
                # The relative address and the 0 id are the only important parts of this region value
                assert get_local_region() == Region(
                    name=MONOLITH_REGION_NAME,
                    id=0,
                    address="http://us.testserver",
                    category=RegionCategory.MULTI_TENANT,
                )
                with override_settings(
                    SENTRY_SINGLE_ORGANIZATION=True,
                ):
                    # The relative address and the 0 id are the only important parts of this region value
                    assert get_local_region() == Region(
                        name=MONOLITH_REGION_NAME,
                        id=0,
                        address="/",
                        category=RegionCategory.MULTI_TENANT,
                    )

    def test_validate_region(self):
        with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="na"):
            invalid_region = Region("na", 1, "na.sentry.io", RegionCategory.MULTI_TENANT)
            with pytest.raises(RegionConfigurationError):
                invalid_region.validate()
            valid_region = Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT)
            valid_region.validate()
