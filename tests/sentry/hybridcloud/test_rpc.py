from __future__ import annotations

from typing import Any
from unittest import mock
from uuid import uuid4

import pytest
import responses
from django.conf import settings
from django.db import router
from django.test import override_settings
from urllib3.connectionpool import HTTPConnectionPool
from urllib3.exceptions import NewConnectionError, ReadTimeoutError

from sentry import options
from sentry.auth.services.auth import AuthService
from sentry.hybridcloud.rpc.service import (
    RpcAuthenticationSetupException,
    RpcCircuitBreakerOpenException,
    RpcDisabledException,
    RpcRemoteException,
    RpcResponseException,
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
from sentry.testutils.cell import override_cells
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import assume_test_silo_mode, no_silo_test
from sentry.types.cell import Cell
from sentry.users.services.user import RpcUser
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.utils import json
from sentry.utils.circuit_breaker2 import CircuitBreaker

_CELLS = [Cell("north_america", 1, "http://na.sentry.io"), Cell("europe", 2, "http://eu.sentry.io")]


@no_silo_test
class RpcServiceTest(TestCase):
    @mock.patch("sentry.hybridcloud.rpc.service.dispatch_remote_call")
    def test_remote_service(self, mock_dispatch_remote_call: mock.MagicMock) -> None:
        target_cell = _CELLS[0]

        user = self.create_user()
        organization = self.create_organization()
        with unguarded_write(using=router.db_for_write(OrganizationMapping)):
            OrganizationMapping.objects.update_or_create(
                organization_id=organization.id,
                defaults={
                    "slug": organization.slug,
                    "name": organization.name,
                    "cell_name": target_cell.name,
                },
            )

        serial_user = RpcUser(id=user.id)
        serial_org = serialize_rpc_organization(organization)

        service = OrganizationService.create_delegation()
        with override_cells(_CELLS), override_settings(SILO_MODE=SiloMode.CONTROL):
            service.add_organization_member(
                organization_id=serial_org.id,
                default_org_role=serial_org.default_role,
                user=serial_user,
                flags=RpcOrganizationMemberFlags(),
                role=None,
            )

        assert mock_dispatch_remote_call.called
        (
            cell,
            service_name,
            method_name,
            serial_arguments,
        ) = mock_dispatch_remote_call.call_args.args
        assert cell == target_cell
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

        with assume_test_silo_mode(SiloMode.CELL):
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
    def test_cell_to_control_happy_path(self) -> None:
        org = self.create_organization()

        response_value = RpcUserOrganizationContext(organization=serialize_rpc_organization(org))
        self._set_up_mock_response("organization/get_organization_by_id", response_value.dict())

        result = dispatch_remote_call(
            None, "organization", "get_organization_by_id", {"id": org.id}
        )
        assert result == response_value

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CELL)
    def test_cell_to_control_null_result(self) -> None:
        self._set_up_mock_response("organization/get_organization_by_id", None)

        result = dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})
        assert result is None

    @staticmethod
    def _set_up_mock_raw_response(service_name: str, body: str) -> None:
        responses.add(
            responses.POST,
            f"{settings.SENTRY_CONTROL_ADDRESS}/api/0/internal/rpc/{service_name}/",
            content_type="json",
            body=body,
        )

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CELL)
    def test_cell_to_control_empty_body(self) -> None:
        self._set_up_mock_raw_response("organization/get_organization_by_id", "")

        with pytest.raises(RpcResponseException) as excinfo:
            dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})

        assert "malformed 200 response of 0 byte(s)" in str(excinfo.value)

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CELL)
    def test_cell_to_control_non_json_body(self) -> None:
        self._set_up_mock_raw_response(
            "organization/get_organization_by_id", "<html>502 Bad Gateway</html>"
        )

        with pytest.raises(RpcResponseException):
            dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})

    @responses.activate
    @override_cells(_CELLS)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_control_to_cell_happy_path(self) -> None:
        user = self.create_user()
        serial = serialize_rpc_user(user)
        self._set_up_mock_response(
            "user/get_first_superuser", serial.dict(), address="http://na.sentry.io"
        )

        result = dispatch_remote_call(_CELLS[0], "user", "get_first_superuser", {})
        assert result == serial

    @responses.activate
    @override_cells(_CELLS)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_cell_to_control_with_list_result(self) -> None:
        users = [self.create_user() for _ in range(3)]
        serial = [serialize_rpc_user(user) for user in users]
        self._set_up_mock_response("user/get_many", [m.dict() for m in serial])

        result = dispatch_remote_call(None, "user", "get_many", {"filter": {}})
        assert result == serial

    @responses.activate
    @override_cells(_CELLS)
    @override_settings(SILO_MODE=SiloMode.CONTROL, DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_early_halt_from_null_cell_resolution(self) -> None:
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            org_service_delgn = OrganizationService.create_delegation(use_test_client=False)
        result = org_service_delgn.get_org_by_slug(slug="this_is_not_a_valid_slug")
        assert result is None

    @staticmethod
    def _retry_metric_calls(mock_distribution: mock.MagicMock) -> list[tuple[int, str]]:
        return [
            (call.args[1], call.kwargs["tags"]["result"])
            for call in mock_distribution.call_args_list
            if call.args[0] == "hybrid_cloud.dispatch_rpc.retries"
        ]

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CELL)
    @override_options({"hybridcloud.rpc.retry-reporting.enabled": True})
    @mock.patch("sentry.hybridcloud.rpc.service.metrics.distribution")
    def test_retry_count_emitted_without_retries(self, mock_distribution: mock.MagicMock) -> None:
        self._set_up_mock_response("organization/get_organization_by_id", None)

        dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})

        assert self._retry_metric_calls(mock_distribution) == [(0, "success")]

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CELL)
    @override_options({"hybridcloud.rpc.retry-reporting.enabled": True})
    @mock.patch("sentry.hybridcloud.rpc.service.metrics.distribution")
    def test_retry_count_emitted_on_success_after_retry(
        self, mock_distribution: mock.MagicMock
    ) -> None:
        responses.add(
            responses.POST,
            f"{settings.SENTRY_CONTROL_ADDRESS}/api/0/internal/rpc/organization/get_organization_by_id/",
            status=503,
        )
        self._set_up_mock_response("organization/get_organization_by_id", None)

        result = dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})

        assert result is None
        assert self._retry_metric_calls(mock_distribution) == [(1, "success")]

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CELL)
    @override_options(
        {"hybridcloud.rpc.retries": 2, "hybridcloud.rpc.retry-reporting.enabled": True}
    )
    @mock.patch("sentry.hybridcloud.rpc.service.metrics.distribution")
    def test_retry_count_emitted_on_exhausted_retries(
        self, mock_distribution: mock.MagicMock
    ) -> None:
        responses.add(
            responses.POST,
            f"{settings.SENTRY_CONTROL_ADDRESS}/api/0/internal/rpc/organization/get_organization_by_id/",
            status=503,
        )

        with pytest.raises(RpcRemoteException, match="max retries reached"):
            dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})

        assert len(responses.calls) == 3
        assert self._retry_metric_calls(mock_distribution) == [(2, "failure")]

    @override_settings(SILO_MODE=SiloMode.CELL)
    @override_options(
        {"hybridcloud.rpc.retries": 2, "hybridcloud.rpc.retry-reporting.enabled": True}
    )
    @mock.patch("sentry.hybridcloud.rpc.service.metrics.distribution")
    def test_retry_count_emitted_on_read_timeouts(self, mock_distribution: mock.MagicMock) -> None:
        # responses doesn't retry raised errors, so fail below urllib3's retry loop instead.
        with mock.patch.object(
            HTTPConnectionPool,
            "_make_request",
            side_effect=ReadTimeoutError(mock.sentinel.pool, "/", "Read timed out."),
        ) as mock_make_request:
            with pytest.raises(RpcRemoteException, match="RPC Connection failed"):
                dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})

        assert mock_make_request.call_count == 3
        assert self._retry_metric_calls(mock_distribution) == [(2, "failure")]

    @override_settings(SILO_MODE=SiloMode.CELL)
    @override_options(
        {"hybridcloud.rpc.retries": 2, "hybridcloud.rpc.retry-reporting.enabled": True}
    )
    @mock.patch("sentry.hybridcloud.rpc.service.metrics.distribution")
    def test_retry_count_emitted_on_connection_errors(
        self, mock_distribution: mock.MagicMock
    ) -> None:
        with mock.patch.object(
            HTTPConnectionPool,
            "_make_request",
            side_effect=NewConnectionError(mock.sentinel.conn, "Connection refused"),
        ) as mock_make_request:
            with pytest.raises(RpcRemoteException, match="RPC Connection failed"):
                dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})

        assert mock_make_request.call_count == 3
        assert self._retry_metric_calls(mock_distribution) == [(2, "failure")]

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CELL)
    @mock.patch("sentry.hybridcloud.rpc.service.metrics.distribution")
    def test_retry_count_not_emitted_when_disabled(self, mock_distribution: mock.MagicMock) -> None:
        responses.add(
            responses.POST,
            f"{settings.SENTRY_CONTROL_ADDRESS}/api/0/internal/rpc/organization/get_organization_by_id/",
            status=503,
        )
        self._set_up_mock_response("organization/get_organization_by_id", None)

        result = dispatch_remote_call(None, "organization", "get_organization_by_id", {"id": 0})

        assert result is None
        assert len(responses.calls) == 2
        assert self._retry_metric_calls(mock_distribution) == []

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
            cell=None,
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
                cell=None,
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
            cell=None,
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
                cell=None,
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


_BREAKER_CONFIG = {
    "error_limit_window": 60,
    "broken_state_duration": 30,
    "threshold": 0.5,
    "floor": 2,
}


@no_silo_test
class RpcCircuitBreakerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # Unique cell names keep breaker state in redis from leaking between tests.
        suffix = uuid4().hex[:8]
        self.failing_cell = Cell(f"failing-{suffix}", 1, "http://failing.sentry.io")
        self.healthy_cell = Cell(f"healthy-{suffix}", 2, "http://healthy.sentry.io")

    def _add_response(self, cell: Cell, **kwargs: Any) -> None:
        responses.add(
            responses.POST,
            f"{cell.address}/api/0/internal/rpc/user/get_first_superuser/",
            content_type="json",
            **kwargs,
        )

    def _call(self, cell: Cell) -> Any:
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            return dispatch_remote_call(cell, "user", "get_first_superuser", {})

    def _fail_calls(self, cell: Cell, count: int, status: int = 504) -> None:
        self._add_response(cell, status=status, body=json.dumps({"detail": "unavailable"}))
        for _ in range(count):
            with pytest.raises(RpcRemoteException):
                self._call(cell)

    @responses.activate
    @override_options(
        {
            "hybridcloud.rpc.circuit-breaker.enabled": True,
            "hybridcloud.rpc.circuit-breaker.enforce": True,
            "hybridcloud.rpc.circuit-breaker.config": _BREAKER_CONFIG,
        }
    )
    def test_open_breaker_rejects_only_its_destination(self) -> None:
        with override_cells([self.failing_cell, self.healthy_cell]):
            self._fail_calls(self.failing_cell, 2)
            sent_before = len(responses.calls)

            with pytest.raises(RpcCircuitBreakerOpenException):
                self._call(self.failing_cell)
            assert len(responses.calls) == sent_before

            serial = serialize_rpc_user(self.create_user())
            self._add_response(
                self.healthy_cell, body=json.dumps({"meta": {}, "value": serial.dict()})
            )
            assert self._call(self.healthy_cell) == serial

    @responses.activate
    @override_options(
        {
            "hybridcloud.rpc.circuit-breaker.enabled": True,
            "hybridcloud.rpc.circuit-breaker.config": _BREAKER_CONFIG,
        }
    )
    @mock.patch("sentry.hybridcloud.rpc.circuit_breaker.metrics.incr")
    def test_log_only_mode_still_sends(self, mock_incr: mock.MagicMock) -> None:
        with override_cells([self.failing_cell]):
            self._fail_calls(self.failing_cell, 2)
            sent_before = len(responses.calls)

            with pytest.raises(RpcRemoteException) as excinfo:
                self._call(self.failing_cell)

            assert not isinstance(excinfo.value, RpcCircuitBreakerOpenException)
            assert len(responses.calls) == sent_before + 1
            mock_incr.assert_any_call(
                "hybrid_cloud.dispatch_rpc.circuit_breaker.rejected", tags=mock.ANY
            )

    @responses.activate
    @override_options(
        {
            "hybridcloud.rpc.circuit-breaker.enabled": True,
            "hybridcloud.rpc.circuit-breaker.enforce": True,
            "hybridcloud.rpc.circuit-breaker.config": _BREAKER_CONFIG,
            "hybridcloud.rpc.circuit-breaker.slow-call-seconds": 0.0,
        }
    )
    def test_slow_calls_count_as_failures(self) -> None:
        with override_cells([self.failing_cell]):
            serial = serialize_rpc_user(self.create_user())
            self._add_response(
                self.failing_cell, body=json.dumps({"meta": {}, "value": serial.dict()})
            )
            self._call(self.failing_cell)
            self._call(self.failing_cell)

            with pytest.raises(RpcCircuitBreakerOpenException):
                self._call(self.failing_cell)

    @responses.activate
    @override_options(
        {
            "hybridcloud.rpc.circuit-breaker.enabled": True,
            "hybridcloud.rpc.circuit-breaker.enforce": True,
            "hybridcloud.rpc.circuit-breaker.config": _BREAKER_CONFIG,
        }
    )
    def test_plain_500s_do_not_trip(self) -> None:
        with override_cells([self.failing_cell]):
            self._fail_calls(self.failing_cell, 5, status=500)

            with pytest.raises(RpcRemoteException) as excinfo:
                self._call(self.failing_cell)
            assert not isinstance(excinfo.value, RpcCircuitBreakerOpenException)

    @responses.activate
    def test_force_open_rejects_listed_destination_only(self) -> None:
        # Works as a manual switch even when the breaker itself is off.
        with (
            override_cells([self.failing_cell, self.healthy_cell]),
            override_options(
                {
                    "hybridcloud.rpc.circuit-breaker.force-open-destinations": [
                        self.failing_cell.name
                    ]
                }
            ),
        ):
            self._add_response(self.failing_cell, body="")
            with pytest.raises(RpcCircuitBreakerOpenException):
                self._call(self.failing_cell)
            assert len(responses.calls) == 0

            serial = serialize_rpc_user(self.create_user())
            self._add_response(
                self.healthy_cell, body=json.dumps({"meta": {}, "value": serial.dict()})
            )
            assert self._call(self.healthy_cell) == serial

    @responses.activate
    @mock.patch("sentry.hybridcloud.rpc.circuit_breaker.traces.get_current_span")
    def test_rejection_is_tagged_on_span(self, mock_get_span: mock.MagicMock) -> None:
        with (
            override_cells([self.failing_cell]),
            override_options(
                {
                    "hybridcloud.rpc.circuit-breaker.force-open-destinations": [
                        self.failing_cell.name
                    ]
                }
            ),
        ):
            with pytest.raises(RpcCircuitBreakerOpenException):
                self._call(self.failing_cell)

        span = mock_get_span.return_value
        span.set_attribute.assert_any_call("circuit_breaker.rejected", "forced")
        span.set_attribute.assert_any_call("circuit_breaker.destination", self.failing_cell.name)

    @responses.activate
    @override_options(
        {
            "hybridcloud.rpc.circuit-breaker.enabled": True,
            "hybridcloud.rpc.circuit-breaker.enforce": True,
            "hybridcloud.rpc.circuit-breaker.config": _BREAKER_CONFIG,
        }
    )
    @mock.patch("sentry.hybridcloud.rpc.circuit_breaker.metrics.incr")
    def test_breaker_errors_are_counted_and_do_not_fail_the_call(
        self, mock_incr: mock.MagicMock
    ) -> None:
        with (
            override_cells([self.failing_cell]),
            mock.patch.object(CircuitBreaker, "should_allow_request", side_effect=Exception),
            mock.patch.object(CircuitBreaker, "record_success", side_effect=Exception),
        ):
            serial = serialize_rpc_user(self.create_user())
            self._add_response(
                self.failing_cell, body=json.dumps({"meta": {}, "value": serial.dict()})
            )
            assert self._call(self.failing_cell) == serial

        error_kinds = [
            call.kwargs["tags"]["kind"]
            for call in mock_incr.call_args_list
            if call.args[0] == "hybrid_cloud.dispatch_rpc.circuit_breaker.error"
        ]
        assert error_kinds == ["check", "record"]

    @responses.activate
    @override_options(
        {
            "hybridcloud.rpc.circuit-breaker.enabled": True,
            "hybridcloud.rpc.circuit-breaker.config": ["not", "a", "dict"],
        }
    )
    @mock.patch("sentry.hybridcloud.rpc.circuit_breaker.metrics.incr")
    def test_invalid_config_does_not_fail_the_call(self, mock_incr: mock.MagicMock) -> None:
        with override_cells([self.failing_cell]):
            serial = serialize_rpc_user(self.create_user())
            self._add_response(
                self.failing_cell, body=json.dumps({"meta": {}, "value": serial.dict()})
            )
            assert self._call(self.failing_cell) == serial

        error_kinds = [
            call.kwargs["tags"]["kind"]
            for call in mock_incr.call_args_list
            if call.args[0] == "hybrid_cloud.dispatch_rpc.circuit_breaker.error"
        ]
        assert error_kinds == ["config"]

    @responses.activate
    @mock.patch("sentry.utils.circuit_breaker2.CircuitBreaker.__init__")
    def test_disabled_by_default(self, mock_init: mock.MagicMock) -> None:
        with override_cells([self.failing_cell]):
            self._fail_calls(self.failing_cell, 3)
        assert not mock_init.called
