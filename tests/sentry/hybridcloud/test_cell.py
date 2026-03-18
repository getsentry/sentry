import pytest
from django.test import override_settings

from sentry.hybridcloud.rpc.resolvers import (
    ByCellName,
    ByOrganizationId,
    ByOrganizationIdAttribute,
    ByOrganizationSlug,
    RequireSingleOrganization,
)
from sentry.models.organizationmember import OrganizationMember
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.region import override_regions
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.cell import Cell, CellResolutionError, RegionCategory

_TEST_CELLS = (
    Cell("north_america", 1, "na.sentry.io", RegionCategory.MULTI_TENANT),
    Cell("europe", 2, "eu.sentry.io", RegionCategory.MULTI_TENANT),
)


@control_silo_test(regions=_TEST_CELLS)
class CellResolutionTest(TestCase):
    def setUp(self) -> None:
        self.target_region = _TEST_CELLS[0]
        self.organization = self.create_organization(region=self.target_region)

    def test_by_cell_name(self) -> None:
        resolver = ByCellName()
        # Primary path: callers using the new cell_name parameter
        assert resolver.resolve({"cell_name": self.target_region.name}) == self.target_region
        # Fallback: callers still using the old region_name parameter
        assert resolver.resolve({"region_name": self.target_region.name}) == self.target_region
        # When both are present, region_name takes precedence over cell_name
        other_region = _TEST_CELLS[1]
        assert (
            resolver.resolve(
                {"cell_name": other_region.name, "region_name": self.target_region.name}
            )
            == self.target_region
        )
        # When neither is passed, raise KeyError
        with pytest.raises(KeyError):
            resolver.resolve({})

    def test_by_organization_id(self) -> None:
        region_resolution = ByOrganizationId()
        arguments = {"organization_id": self.organization.id}
        actual_region = region_resolution.resolve(arguments)
        assert actual_region == self.target_region

    def test_by_organization_slug(self) -> None:
        region_resolution = ByOrganizationSlug()
        arguments = {"slug": self.organization.slug}
        actual_region = region_resolution.resolve(arguments)
        assert actual_region == self.target_region

    def test_by_organization_id_attribute(self) -> None:
        region_resolution = ByOrganizationIdAttribute("organization_member")
        with assume_test_silo_mode(SiloMode.CELL):
            org_member = OrganizationMember.objects.create(
                organization_id=self.organization.id,
                user_id=self.user.id,
            )
        arguments = {"organization_member": org_member}
        actual_region = region_resolution.resolve(arguments)
        assert actual_region == self.target_region

    def test_require_single_organization(self) -> None:
        cell_resolution = RequireSingleOrganization()

        with (
            override_regions([self.target_region]),
            override_settings(SENTRY_SINGLE_ORGANIZATION=True),
        ):
            actual_region = cell_resolution.resolve({})
            assert actual_region == self.target_region

        with (
            override_regions([self.target_region]),
            override_settings(SENTRY_SINGLE_ORGANIZATION=False),
        ):
            with pytest.raises(CellResolutionError):
                cell_resolution.resolve({})

        with override_regions(_TEST_CELLS), override_settings(SENTRY_SINGLE_ORGANIZATION=True):
            self.create_organization(region=_TEST_CELLS[1])
            with pytest.raises(CellResolutionError):
                cell_resolution.resolve({})
