import pytest

from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.services.hybrid_cloud.region import (
    ByOrganizationId,
    ByOrganizationIdAttribute,
    ByOrganizationObject,
    ByOrganizationSlug,
    UnimplementedRegionResolution,
)
from sentry.services.hybrid_cloud.rpc import RpcServiceUnimplementedException
from sentry.testutils import TestCase
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test
class RegionResolutionTest(TestCase):
    def setUp(self):
        self.regions = [
            Region("north_america", 1, "na.sentry.io", RegionCategory.MULTI_TENANT),
            Region("europe", 2, "eu.sentry.io", RegionCategory.MULTI_TENANT),
        ]
        self.target_region = self.regions[0]
        self.organization = self.create_organization(no_mapping=True)
        OrganizationMapping.objects.create(
            organization_id=self.organization.id,
            slug=self.organization.slug,
            name=self.organization.name,
            region_name=self.target_region.name,
        )

    def test_by_organization_object(self):
        with override_regions(self.regions):
            region_resolution = ByOrganizationObject()
            arguments = {"organization": self.organization}
            actual_region = region_resolution.resolve(arguments)
            assert actual_region == self.target_region

    def test_by_organization_id(self):
        with override_regions(self.regions):
            region_resolution = ByOrganizationId()
            arguments = {"organization_id": self.organization.id}
            actual_region = region_resolution.resolve(arguments)
            assert actual_region == self.target_region

    def test_by_organization_slug(self):
        with override_regions(self.regions):
            region_resolution = ByOrganizationSlug()
            arguments = {"slug": self.organization.slug}
            actual_region = region_resolution.resolve(arguments)
            assert actual_region == self.target_region

    def test_by_organization_id_attribute(self):
        with override_regions(self.regions):
            region_resolution = ByOrganizationIdAttribute("organization_member")
            org_member = OrganizationMember.objects.create(
                organization_id=self.organization.id,
                user_id=self.user.id,
            )
            arguments = {"organization_member": org_member}
            actual_region = region_resolution.resolve(arguments)
            assert actual_region == self.target_region

    def test_unimplemented_region_resolution(self):
        with override_regions(self.regions):
            region_resolution = UnimplementedRegionResolution()
            with pytest.raises(RpcServiceUnimplementedException):
                arguments = {"team_id": 1234}
                region_resolution.resolve(arguments)
