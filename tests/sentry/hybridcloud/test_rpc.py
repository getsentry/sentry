from __future__ import annotations

from typing import Any
from unittest import mock

import pytest
import responses
from django.conf import settings
from django.db import router
from django.test import override_settings

from sentry import options
from sentry.auth.services.auth import AuthService
from sentry.hybridcloud.rpc.service import (
    RpcAuthenticationSetupException,
    RpcDisabledException,
    _RemoteSiloCall,
    dispatch_remote_call,
    dispatch_to_local_service,
)
from sentry.models.organizationmapping import OrganizationMapping
from sentry.organizations.services.organization import (
    OrganizationService,
    RpcOrganizationMemberFlags,
    RpcUserOrganizationContext,
)
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.region import override_regions
from sentry.testutils.silo import assume_test_silo_mode, no_silo_test
from sentry.types.region import Region, RegionCategory
from sentry.users.services.user import RpcUser
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.utils import json

_REGIONS = [
    Region("north_america", 1, "http://na.sentry.io", RegionCategory.MULTI_TENANT),
    Region("europe", 2, "http://eu.sentry.io", RegionCategory.MULTI_TENANT),
]


@no_silo_test
class RpcServiceTest(TestCase):
    @mock.patch("sentry.hybridcloud.rpc.service.dispatch_remote_call")
    def test_remote_service(self, mock_dispatch_remote_call: mock.MagicMock) -> None:
        target_region = _REGIONS[0]

        user = self.create_user()
        organization = self.create_organization()
        with unguarded_write(using=router.db_for_write(OrganizationMapping)):
            OrganizationMapping.objects.update_or_create(
                organization_id=organization.id,
                defaults={
                    "slug": organization.slug,
                    "name": organization.name,
                    "region_name": target_region.name,
                },
            )

        serial_user = RpcUser(id=user.id)
        serial_org = serialize_rpc_organization(organization)

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
            "user_id",
            "email",
            "flags",
            "role",
            "inviter_id",
            "invite_status",
        }
        assert serial_arguments["organization_id"] == organization.id

    def test_dispatch_to_local_service(self) -> None:
        user = self.create_user()
        organization = self.create_organization()

        serial_org = serialize_rpc_organization(organization)
        serial_arguments = dict(
            organization_id=serial_org.id,
            default_org_role=serial_org.default_role,
            user_id=user.id,
            flags=RpcOrganizationMemberFlags().dict(),
            role=None,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            service = OrganizationService.create_delegation()
            dispatch_to_local_service(service.key, "add_organization_member", serial_arguments)

    def test_dispatch_to_local_service_list_result(self) -> None:
        organization = self.create_organization()

        args = {"organization_ids": [organization.id]}
        with assume_test_silo_mode(SiloMode.CONTROL):
            service = AuthService.create_delegation()
            response = dispatch_to_local_service(service.key, "get_org_auth_config", args)
            result = response["value"]
            assert len(result) == 1
            assert result[0]["organization_id"] == organization.id


control_address = "https://control.example.com"


@no_silo_test
class DispatchRemoteCallTest(TestCase):
    @override_settings(
        SILO_MODE=SiloMode.CONTROL,
        RPC_SHARED_SECRET=[],
        SENTRY_CONTROL_ADDRESS="",
    )
    def test_while_not_allowed(self) -> None:
        with pytest.raises(RpcAuthenticationSetupException):
            dispatch_remote_call(None, "user", "get_user", {"user_id": 0})

    @staticmethod
    def _set_up_mock_response(
        service_name: str, response_value: Any, address: str | None = None
    ) -> None:
        address = address or settings.SENTRY_CONTROL_ADDRESS
        responses.add(
            responses.POST,
            f"{address}/api/0/internal/rpc/{service_name}/",
            content_type="json",
            body=json.dumps({"meta": {}, "value": response_value}),
        )

    @responses.activate
    def test_region_to_control_happy_path(self) -> None:
        org = self.create_organization()

        response_value = RpcUserOrganizationContext(organization=serialize_rpc_organization(org))
        self._set_up_mock_response("organization/get_organization_by_id", response_value.dict())

        result = dispatch_remote_call(
            None, "organization", "get_organization_by_id", {"id": org.id}
        )
        assert result == response_value

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.REGION)
    def test_region_to_control_null_result(self) -> None:
        self._set_up_mock_response("organization/get_organization_by_id", None)

        result = dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})
        assert result is None

    @responses.activate
    @override_regions(_REGIONS)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_control_to_region_happy_path(self) -> None:
        user = self.create_user()
        serial = serialize_rpc_user(user)
        self._set_up_mock_response(
            "user/get_first_superuser", serial.dict(), address="http://na.sentry.io"
        )

        result = dispatch_remote_call(_REGIONS[0], "user", "get_first_superuser", {})
        assert result == serial

    @responses.activate
    @override_regions(_REGIONS)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_region_to_control_with_list_result(self) -> None:
        users = [self.create_user() for _ in range(3)]
        serial = [serialize_rpc_user(user) for user in users]
        self._set_up_mock_response("user/get_many", [m.dict() for m in serial])

        result = dispatch_remote_call(None, "user", "get_many", {"filter": {}})
        assert result == serial

    @responses.activate
    @override_regions(_REGIONS)
    @override_settings(SILO_MODE=SiloMode.CONTROL, DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_early_halt_from_null_region_resolution(self) -> None:
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            org_service_delgn = OrganizationService.create_delegation(use_test_client=False)
        result = org_service_delgn.get_org_by_slug(slug="this_is_not_a_valid_slug")
        assert result is None

    @override_options(
        {"hybrid_cloud.rpc.disabled-service-methods": ["organization.get_organization_by_id"]}
    )
    def test_disable_rpc_method(self) -> None:
        with pytest.raises(RpcDisabledException):
            dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})

    def test_get_method_timeout(self) -> None:
        override_value = 20.0
        assert settings.RPC_TIMEOUT is not None
        assert override_value != settings.RPC_TIMEOUT

        timeout_override_setting: dict[str, Any] = {
            "organization_service.get_org_by_id": override_value
        }

        # Test for no value
        test_class = _RemoteSiloCall(
            service_name="organization_service",
            method_name="get_org_by_id",
            region=None,
            serial_arguments={},
        )

        assert test_class.get_method_timeout() == settings.RPC_TIMEOUT

        # Test overridden value
        with override_options(
            {
                "hybridcloud.rpc.method_timeout_overrides": timeout_override_setting,
            }
        ):
            test_class = _RemoteSiloCall(
                service_name="organization_service",
                method_name="get_org_by_id",
                region=None,
                serial_arguments={},
            )

            assert test_class.get_method_timeout() == override_value

        # Test for invalid values
        with override_options({"hybridcloud.rpc.method_timeout_overrides": 10}):
            assert test_class.get_method_timeout() == settings.RPC_TIMEOUT

        timeout_override_setting = {"organization_service.get_org_by_id": "oops"}
        with override_options(
            {"hybridcloud.rpc.method_timeout_overrides": timeout_override_setting}
        ):
            assert test_class.get_method_timeout() == settings.RPC_TIMEOUT

        # Test for missing value
        timeout_override_setting = {"organization_service.some_other_method": 20.0}
        with override_options(
            {"hybridcloud.rpc.method_timeout_overrides": timeout_override_setting}
        ):
            assert test_class.get_method_timeout() == settings.RPC_TIMEOUT

    def test_get_method_retry_count(self) -> None:
        override_value = 1
        default_value = options.get("hybridcloud.rpc.retries")
        assert default_value is not None
        assert override_value != default_value

        retry_override_setting: dict[str, Any] = {
            "organization_service.get_org_by_id": override_value
        }

        # Test for no value
        test_class = _RemoteSiloCall(
            service_name="organization_service",
            method_name="get_org_by_id",
            region=None,
            serial_arguments={},
        )

        assert test_class.get_method_retry_count() == default_value

        # Test overridden value
        with override_options(
            {
                "hybridcloud.rpc.method_retry_overrides": retry_override_setting,
            }
        ):
            test_class = _RemoteSiloCall(
                service_name="organization_service",
                method_name="get_org_by_id",
                region=None,
                serial_arguments={},
            )

            assert test_class.get_method_retry_count() == override_value

        # Test for invalid values
        with override_options({"hybridcloud.rpc.method_retry_overrides": 10}):
            assert test_class.get_method_retry_count() == default_value

        retry_override_setting = {"organization_service.get_org_by_id": "oops"}
        with override_options({"hybridcloud.rpc.method_retry_overrides": retry_override_setting}):
            assert test_class.get_method_retry_count() == default_value

        # Test for missing value
        timeout_override_setting = {"organization_service.some_other_method": 20}
        with override_options({"hybridcloud.rpc.method_retry_overrides": timeout_override_setting}):
            assert test_class.get_method_retry_count() == default_value
