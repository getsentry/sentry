import pytest
from django.test import override_settings

from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.services.hybrid_cloud.region import (
    ByOrganizationId,
    ByOrganizationIdAttribute,
    ByOrganizationObject,
    ByOrganizationSlug,
    RequireSingleOrganization,
    UnimplementedRegionResolution,
)
from sentry.services.hybrid_cloud.rpc import RpcServiceUnimplementedException
from sentry.silo import SiloMode, unguarded_write
from sentry.testutils import TestCase
from sentry.testutils.region import override_regions
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.region import Region, RegionCategory, RegionResolutionError


@control_silo_test(stable=True)
class RegionResolutionTest(TestCase):
    def setUp(self):
        self.regions = [
            Region("north_america", 1, "na.sentry.io", RegionCategory.MULTI_TENANT),
            Region("europe", 2, "eu.sentry.io", RegionCategory.MULTI_TENANT),
        ]
        self.target_region = self.regions[0]
        self.organization = self._create_org_in_region(self.target_region)

    def _create_org_in_region(self, target_region):
        with override_settings(SENTRY_REGION=target_region.name):
            organization = self.create_organization()
        org_mapping = OrganizationMapping.objects.get(organization_id=organization.id)
        with unguarded_write():
            org_mapping.region_name = target_region.name
            org_mapping.save()
        return organization

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
            with assume_test_silo_mode(SiloMode.REGION):
                org_member = OrganizationMember.objects.create(
                    organization_id=self.organization.id,
                    user_id=self.user.id,
                )
            arguments = {"organization_member": org_member}
            actual_region = region_resolution.resolve(arguments)
            assert actual_region == self.target_region

    def test_require_single_organization(self):
        region_resolution = RequireSingleOrganization()

        with override_regions([self.target_region]), override_settings(
            SENTRY_SINGLE_ORGANIZATION=True
        ):
            actual_region = region_resolution.resolve({})
            assert actual_region == self.target_region

        with override_regions([self.target_region]), override_settings(
            SENTRY_SINGLE_ORGANIZATION=False
        ):
            with pytest.raises(RegionResolutionError):
                region_resolution.resolve({})

        with override_regions(self.regions), override_settings(SENTRY_SINGLE_ORGANIZATION=True):
            self._create_org_in_region(self.regions[1])
            with pytest.raises(RegionResolutionError):
                region_resolution.resolve({})

    def test_unimplemented_region_resolution(self):
        with override_regions(self.regions):
            region_resolution = UnimplementedRegionResolution()
            with pytest.raises(RpcServiceUnimplementedException):
                arguments = {"team_id": 1234}
                region_resolution.resolve(arguments)
