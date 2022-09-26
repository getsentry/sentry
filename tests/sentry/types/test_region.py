import pytest
from django.test import override_settings

from sentry.silo import SiloMode
from sentry.testutils import TestCase
from sentry.types.region import (
    Region,
    RegionCategory,
    RegionContextError,
    RegionMapping,
    RegionResolutionError,
)


class RegionMappingTest(TestCase):
    def test_region_mapping(self):
        regions = [
            Region("north_america", 1, "na.sentry.io", RegionCategory.GEOGRAPHIC),
            Region("europe", 2, "eu.sentry.io", RegionCategory.GEOGRAPHIC),
            Region("acme-single-tenant", 3, "acme.my.sentry.io", RegionCategory.SINGLE_TENANT),
        ]
        mapping = RegionMapping(regions)

        assert mapping.get_by_id(1) == regions[0]
        assert mapping.get_by_name("europe") == regions[1]

        with pytest.raises(RegionResolutionError):
            mapping.get_by_id(4)
        with pytest.raises(RegionResolutionError):
            mapping.get_by_name("nowhere")

    def test_get_for_organization(self):
        org = self.create_organization()
        with pytest.raises(RegionContextError):
            RegionMapping([]).get_for_organization(org)

    def test_get_local_region(self):
        empty_mapping = RegionMapping([])
        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            with pytest.raises(RegionContextError):
                empty_mapping.get_local_region()
