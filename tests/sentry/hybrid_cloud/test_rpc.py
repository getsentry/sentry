from django.test import override_settings

from sentry.services.hybrid_cloud.organization import (
    OrganizationService,
    RpcOrganizationMemberFlags,
)
from sentry.services.hybrid_cloud.organization.impl import DatabaseBackedOrganizationService
from sentry.services.hybrid_cloud.rpc import dispatch_to_local_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode
from sentry.testutils import TestCase


class RpcServiceTest(TestCase):
    def test_remote_service(self):
        user = self.create_user()
        organization = self.create_organization()

        serial_user = RpcUser(id=user.id)
        serial_org = DatabaseBackedOrganizationService.serialize_organization(organization)

        with override_settings(SILO_MODE=SiloMode.CONTROL):
            service = OrganizationService.create_delegation()

            service.add_organization_member(
                organization=serial_org,
                user=serial_user,
                flags=RpcOrganizationMemberFlags(),
                role=None,
            )

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
            service = OrganizationService.create_delegation()
            dispatch_to_local_service(service.name, "add_organization_member", serial_arguments)
