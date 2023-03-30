from unittest import mock

from django.test import override_settings

from sentry.services.hybrid_cloud.actor import RpcActor
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

    @mock.patch("sentry.services.hybrid_cloud.report_pydantic_type_validation_error")
    def test_models_tolerate_invalid_types(self, mock_report):
        # Create an RpcModel instance whose fields don't obey type annotations and
        # ensure that it does not raise an exception.
        RpcActor(
            id="hey, this isn't an int",
            actor_id=None,  # this one is okay
            actor_type=None,  # should not be Optional
        )

        assert mock_report.call_count == 2
        field_names = {c.args[0].name for c in mock_report.call_args_list}
        model_classes = [c.args[3] for c in mock_report.call_args_list]
        assert field_names == {"id", "actor_type"}
        assert model_classes == [RpcActor] * 2

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
            dispatch_to_local_service(service.key, "add_organization_member", serial_arguments)
