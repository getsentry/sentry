from unittest import mock

from django.test import override_settings

from sentry.models import Organization, OrganizationMapping
from sentry.services.hybrid_cloud.organization import (
    OrganizationService,
    RpcOrganizationMemberFlags,
)
from sentry.services.hybrid_cloud.organization.impl import DatabaseBackedOrganizationService
from sentry.services.hybrid_cloud.rpc import dispatch_to_local_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.region import override_regions
from sentry.types.region import Region, RegionCategory


class RpcServiceTest(TestCase):
    @mock.patch("sentry.services.hybrid_cloud.rpc.dispatch_remote_call")
    def test_remote_service(self, mock_dispatch_remote_call):
        regions = [
            Region("north_america", 1, "na.sentry.io", RegionCategory.MULTI_TENANT),
            Region("europe", 2, "eu.sentry.io", RegionCategory.MULTI_TENANT),
        ]

        user = self.create_user()
        organization: Organization = self.create_organization()
        OrganizationMapping.objects.create(
            organization_id=organization.id,
            slug=organization.slug,
            name=organization.name,
            region_name=regions[0].name,
        )

        serial_user = RpcUser(id=user.id)
        serial_org = DatabaseBackedOrganizationService.serialize_organization(organization)

        with override_regions(regions):
            with override_settings(SILO_MODE=SiloMode.CONTROL):
                service = OrganizationService.resolve_to_delegation()

                service.add_organization_member(
                    organization=serial_org,
                    user=serial_user,
                    flags=RpcOrganizationMemberFlags(),
                    role=None,
                )

        assert mock_dispatch_remote_call.called
        (
            region,
            service_name,
            method_name,
            serial_arguments,
        ) = mock_dispatch_remote_call.call_args.args
        assert region == regions[0]
        assert service_name == OrganizationService.name
        assert method_name == "add_organization_member"
        assert serial_arguments.keys() == {"flags", "organization", "role", "user"}
        assert serial_arguments["organization"]["id"] == organization.id

    def test_dispatch_to_local_service(self):
        user = self.create_user()
        organization = self.create_organization()

        serial_user = RpcUser(id=user.id)
        serial_org = DatabaseBackedOrganizationService.serialize_organization(organization)
        serial_arguments = dict(
            organization=serial_org.dict(),
            user=serial_user.dict(),
            flags=RpcOrganizationMemberFlags().dict(),
            role=None,
        )

        with override_settings(SILO_MODE=SiloMode.REGION):
            service = OrganizationService.resolve_to_delegation()
            dispatch_to_local_service(service.name, "add_organization_member", serial_arguments)
