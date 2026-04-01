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
from sentry.testutils.cell import override_cells
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.cell import Cell, CellResolutionError, RegionCategory

_TEST_CELLS = (
    Cell("north_america", 1, "na.sentry.io", RegionCategory.MULTI_TENANT),
    Cell("europe", 2, "eu.sentry.io", RegionCategory.MULTI_TENANT),
)


@control_silo_test(cells=_TEST_CELLS)
class CellResolutionTest(TestCase):
    def setUp(self) -> None:
        self.target_cell = _TEST_CELLS[0]
        self.organization = self.create_organization(cell=self.target_cell)

    def test_by_cell_name(self) -> None:
        resolver = ByCellName()
        assert resolver.resolve({"cell_name": self.target_cell.name}) == self.target_cell
        # When no cell_name is passed, raise KeyError
        with pytest.raises(KeyError):
            resolver.resolve({})

    def test_by_organization_id(self) -> None:
        cell_resolution = ByOrganizationId()
        arguments = {"organization_id": self.organization.id}
        actual_cell = cell_resolution.resolve(arguments)
        assert actual_cell == self.target_cell

    def test_by_organization_slug(self) -> None:
        cell_resolution = ByOrganizationSlug()
        arguments = {"slug": self.organization.slug}
        actual_cell = cell_resolution.resolve(arguments)
        assert actual_cell == self.target_cell

    def test_by_organization_id_attribute(self) -> None:
        cell_resolution = ByOrganizationIdAttribute("organization_member")
        with assume_test_silo_mode(SiloMode.CELL):
            org_member = OrganizationMember.objects.create(
                organization_id=self.organization.id,
                user_id=self.user.id,
            )
        arguments = {"organization_member": org_member}
        actual_cell = cell_resolution.resolve(arguments)
        assert actual_cell == self.target_cell

    def test_require_single_organization(self) -> None:
        cell_resolution = RequireSingleOrganization()

        with (
            override_cells([self.target_cell]),
            override_settings(SENTRY_SINGLE_ORGANIZATION=True),
        ):
            actual_cell = cell_resolution.resolve({})
            assert actual_cell == self.target_cell

        with (
            override_cells([self.target_cell]),
            override_settings(SENTRY_SINGLE_ORGANIZATION=False),
        ):
            with pytest.raises(CellResolutionError):
                cell_resolution.resolve({})

        with override_cells(_TEST_CELLS), override_settings(SENTRY_SINGLE_ORGANIZATION=True):
            self.create_organization(cell=_TEST_CELLS[1])
            with pytest.raises(CellResolutionError):
                cell_resolution.resolve({})
