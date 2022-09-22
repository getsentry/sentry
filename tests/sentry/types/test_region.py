from django.test import override_settings

from sentry.silo import SiloMode
from sentry.testutils import TestCase
from sentry.types.region import Region, RegionCategory, RegionMapping


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

    def test_get_for_organization(self):
        org = self.create_organization()
        assert RegionMapping([]).get_for_organization(org) is None

    def test_get_local_region(self):
        empty_mapping = RegionMapping([])
        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            assert empty_mapping.get_local_region() is None
