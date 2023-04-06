from unittest import mock
from unittest.mock import MagicMock

import pytest
from django.test import override_settings

from sentry.models import OrganizationMapping
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.organization import (
    OrganizationService,
    RpcOrganizationMemberFlags,
    RpcUserOrganizationContext,
)
from sentry.services.hybrid_cloud.organization.impl import DatabaseBackedOrganizationService
from sentry.services.hybrid_cloud.rpc import (
    RpcSendException,
    dispatch_remote_call,
    dispatch_to_local_service,
)
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.impl import serialize_rpc_user
from sentry.silo import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.region import override_regions
from sentry.types.region import Region, RegionCategory
from sentry.utils import json

_REGIONS = [
    Region("north_america", 1, "http://na.sentry.io", RegionCategory.MULTI_TENANT, "swordfish"),
    Region("europe", 2, "http://eu.sentry.io", RegionCategory.MULTI_TENANT, "courage"),
]


class RpcServiceTest(TestCase):
    @mock.patch("sentry.services.hybrid_cloud.rpc.dispatch_remote_call")
    def test_remote_service(self, mock_dispatch_remote_call):
        target_region = _REGIONS[0]

        user = self.create_user()
        organization = self.create_organization()
        OrganizationMapping.objects.create(
            organization_id=organization.id,
            slug=organization.slug,
            name=organization.name,
            region_name=target_region.name,
        )

        serial_user = RpcUser(id=user.id)
        serial_org = DatabaseBackedOrganizationService.serialize_organization(organization)

        service = OrganizationService.create_delegation()
        with override_regions(_REGIONS), override_settings(SILO_MODE=SiloMode.CONTROL):
            service.add_organization_member(
                organization_id=serial_org.id,
                default_org_role=serial_org.default_role,
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
        assert region == target_region
        assert service_name == OrganizationService.key
        assert method_name == "add_organization_member"
        assert serial_arguments.keys() == {
            "organization_id",
            "default_org_role",
            "user",
            "email",
            "flags",
            "role",
            "inviter_id",
            "invite_status",
        }
        assert serial_arguments["organization_id"] == organization.id

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
            organization_id=serial_org.id,
            default_org_role=serial_org.default_role,
            user=serial_user.dict(),
            flags=RpcOrganizationMemberFlags().dict(),
            role=None,
        )

        with override_settings(SILO_MODE=SiloMode.REGION):
            service = OrganizationService.create_delegation()
            dispatch_to_local_service(service.key, "add_organization_member", serial_arguments)


class DispatchRemoteCallTest(TestCase):
    def test_while_not_allowed(self):
        with pytest.raises(RpcSendException):
            dispatch_remote_call(None, "user", "get_user", {"id": 0})

    _REGION_SILO_CREDS = {
        "is_allowed": True,
        "control_silo_api_token": "letmein",
        "control_silo_address": "http://localhost",
    }

    @staticmethod
    def _set_up_mock_response(mock_urlopen, response_value):
        charset = "utf-8"
        response_body = json.dumps(response_value).encode(charset)

        mock_response = MagicMock()
        mock_response.headers.get_content_charset.return_value = charset
        mock_response.read.return_value = response_body
        mock_urlopen.return_value.__enter__.return_value = mock_response

    @override_settings(SILO_MODE=SiloMode.REGION, DEV_HYBRID_CLOUD_RPC_SENDER=_REGION_SILO_CREDS)
    @mock.patch("sentry.services.hybrid_cloud.rpc.urlopen")
    def test_region_to_control_happy_path(self, mock_urlopen):
        org = self.create_organization()
        response_value = RpcUserOrganizationContext(
            organization=DatabaseBackedOrganizationService.serialize_organization(org)
        )
        self._set_up_mock_response(mock_urlopen, response_value.dict())

        result = dispatch_remote_call(
            None, "organization", "get_organization_by_id", {"id": org.id}
        )
        assert result == response_value

    @override_settings(SILO_MODE=SiloMode.REGION, DEV_HYBRID_CLOUD_RPC_SENDER=_REGION_SILO_CREDS)
    @mock.patch("sentry.services.hybrid_cloud.rpc.urlopen")
    def test_region_to_control_null_result(self, mock_urlopen):
        self._set_up_mock_response(mock_urlopen, None)

        result = dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})
        assert result is None

    @override_regions(_REGIONS)
    @override_settings(SILO_MODE=SiloMode.CONTROL, DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    @mock.patch("sentry.services.hybrid_cloud.rpc.urlopen")
    def test_control_to_region_happy_path(self, mock_urlopen):
        user = self.create_user()
        serial = serialize_rpc_user(user)
        self._set_up_mock_response(mock_urlopen, serial.dict())

        result = dispatch_remote_call(_REGIONS[0], "user", "get_user", {"id": 0})
        assert result == serial

    @override_regions(_REGIONS)
    @override_settings(SILO_MODE=SiloMode.CONTROL, DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    @mock.patch("sentry.services.hybrid_cloud.rpc.urlopen")
    def test_control_to_region_with_list_result(self, mock_urlopen):
        users = [self.create_user() for _ in range(3)]
        serial = [serialize_rpc_user(user) for user in users]
        self._set_up_mock_response(mock_urlopen, [m.dict() for m in serial])

        result = dispatch_remote_call(_REGIONS[0], "user", "get_many", {"filter": {}})
        assert result == serial
