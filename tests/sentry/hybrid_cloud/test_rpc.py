from abc import abstractmethod
from typing import Any, Optional, cast
from unittest import mock

import pytest
import responses
from django.db import router
from django.test import override_settings

from sentry.models import OrganizationMapping
from sentry.services.hybrid_cloud.auth import AuthService
from sentry.services.hybrid_cloud.organization import RpcUserOrganizationContext
from sentry.services.hybrid_cloud.organization.serial import serialize_rpc_organization
from sentry.services.hybrid_cloud.region import ByOrganizationId, ByOrganizationSlug
from sentry.services.hybrid_cloud.rpc import (
    RpcAuthenticationSetupException,
    RpcService,
    dispatch_remote_call,
    dispatch_to_local_service,
    regional_rpc_method,
)
from sentry.services.hybrid_cloud.user.serial import serialize_rpc_user
from sentry.silo import SiloMode, unguarded_write
from sentry.testutils.cases import TestCase
from sentry.testutils.region import override_regions
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.region import Region, RegionCategory
from sentry.utils import json

_REGIONS = [
    Region("north_america", 1, "http://na.sentry.io", RegionCategory.MULTI_TENANT, "swordfish"),
    Region("europe", 2, "http://eu.sentry.io", RegionCategory.MULTI_TENANT, "courage"),
]


class RpcServiceTest(TestCase):
    class ImaginaryService(RpcService):
        key = "imaginary"
        local_mode = SiloMode.REGION

        @classmethod
        def get_local_implementation(cls) -> RpcService:
            return RpcServiceTest.ImaginaryServiceLocalImpl()

        @regional_rpc_method(resolve=ByOrganizationId())
        @abstractmethod
        def set_organization_thing(self, *, organization_id: int, thing: int) -> int:
            pass

        @regional_rpc_method(resolve=ByOrganizationSlug(), return_none_if_mapping_not_found=True)
        @abstractmethod
        def look_something_up_by_slug(self, *, slug: str) -> Optional[str]:
            pass

    class ImaginaryServiceLocalImpl(ImaginaryService):
        def set_organization_thing(self, *, organization_id: int, thing: int) -> int:
            return 2

        def look_something_up_by_slug(self, *, slug: str) -> Optional[str]:
            return "here it is"

    @mock.patch("sentry.services.hybrid_cloud.rpc.dispatch_remote_call")
    def test_remote_service(self, mock_dispatch_remote_call):
        target_region = _REGIONS[0]

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

        service = RpcServiceTest.ImaginaryService.create_delegation()
        with override_regions(_REGIONS), override_settings(SILO_MODE=SiloMode.CONTROL):
            service.set_organization_thing(organization_id=organization.id, thing=3)

        assert mock_dispatch_remote_call.called
        (
            region,
            service_name,
            method_name,
            serial_arguments,
        ) = mock_dispatch_remote_call.call_args.args
        assert region == target_region
        assert service_name == RpcServiceTest.ImaginaryService.key
        assert method_name == "set_organization_thing"
        assert serial_arguments.keys() == {"organization_id", "thing"}
        assert serial_arguments["organization_id"] == organization.id
        assert serial_arguments["thing"] == 3

    def test_dispatch_to_local_service(self):
        serial_arguments = dict(organization_id=4, thing=5)

        with assume_test_silo_mode(SiloMode.REGION):
            service = RpcServiceTest.ImaginaryService.create_delegation()
            result = dispatch_to_local_service(
                service.key, "set_organization_thing", serial_arguments
            )
        assert result["value"] == 2

    def test_dispatch_to_local_service_list_result(self):
        organization = self.create_organization()

        args = {"organization_ids": [organization.id]}
        with assume_test_silo_mode(SiloMode.CONTROL):
            service = AuthService.create_delegation()
            response = dispatch_to_local_service(service.key, "get_org_auth_config", args)
            result = response["value"]
            assert len(result) == 1
            assert result[0]["organization_id"] == organization.id


control_address = "https://control.example.com"
shared_secret = ["a-long-token-you-could-not-guess"]


class DispatchRemoteCallTest(TestCase):
    @override_settings(
        SILO_MODE=SiloMode.CONTROL,
        RPC_SHARED_SECRET=[],
        SENTRY_CONTROL_ADDRESS="",
    )
    def test_while_not_allowed(self):
        with pytest.raises(RpcAuthenticationSetupException):
            dispatch_remote_call(None, "user", "get_user", {"user_id": 0})

    @staticmethod
    def _set_up_mock_response(
        service_name: str, response_value: Any, address: Optional[str] = None
    ):
        address = address or control_address
        responses.add(
            responses.POST,
            f"{address}/api/0/internal/rpc/{service_name}/",
            content_type="json",
            body=json.dumps({"meta": {}, "value": response_value}),
        )

    @responses.activate
    def test_region_to_control_happy_path(self):
        org = self.create_organization()

        with override_settings(
            RPC_SHARED_SECRET=shared_secret, SENTRY_CONTROL_ADDRESS=control_address
        ):
            response_value = RpcUserOrganizationContext(
                organization=serialize_rpc_organization(org)
            )
            self._set_up_mock_response("organization/get_organization_by_id", response_value.dict())

            result = dispatch_remote_call(
                None, "organization", "get_organization_by_id", {"id": org.id}
            )
            assert result == response_value

    @responses.activate
    @override_settings(
        SILO_MODE=SiloMode.REGION,
        RPC_SHARED_SECRET=shared_secret,
        SENTRY_CONTROL_ADDRESS=control_address,
    )
    def test_region_to_control_null_result(self):
        self._set_up_mock_response("organization/get_organization_by_id", None)

        result = dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})
        assert result is None

    @responses.activate
    @override_regions(_REGIONS)
    @override_settings(
        SILO_MODE=SiloMode.CONTROL,
        RPC_SHARED_SECRET=shared_secret,
        SENTRY_CONTROL_ADDRESS=control_address,
    )
    def test_control_to_region_happy_path(self):
        user = self.create_user()
        serial = serialize_rpc_user(user)
        self._set_up_mock_response("user/get_user", serial.dict(), address="http://na.sentry.io")

        result = dispatch_remote_call(_REGIONS[0], "user", "get_user", {"id": 0})
        assert result == serial

    @responses.activate
    @override_regions(_REGIONS)
    @override_settings(
        SILO_MODE=SiloMode.CONTROL,
        RPC_SHARED_SECRET=shared_secret,
        SENTRY_CONTROL_ADDRESS=control_address,
    )
    def test_region_to_control_with_list_result(self):
        users = [self.create_user() for _ in range(3)]
        serial = [serialize_rpc_user(user) for user in users]
        self._set_up_mock_response("user/get_many", [m.dict() for m in serial])

        result = dispatch_remote_call(None, "user", "get_many", {"filter": {}})
        assert result == serial

    @responses.activate
    @override_regions(_REGIONS)
    @override_settings(SILO_MODE=SiloMode.CONTROL, DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_early_halt_from_null_region_resolution(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            service_delgn = cast(
                RpcServiceTest.ImaginaryService,
                RpcServiceTest.ImaginaryService.create_delegation(use_test_client=False),
            )
        result = service_delgn.look_something_up_by_slug(slug="this_is_not_a_valid_slug")
        assert result is None
