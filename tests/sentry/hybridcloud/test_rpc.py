from __future__ import annotations

import errno
import socket
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
from typing import Any
from unittest import mock

import pytest
import requests
import responses
import sentry_sdk
from django.conf import settings
from django.db import router
from django.test import override_settings
from requests.adapters import HTTPAdapter
from sentry_sdk.tracing import Span
from urllib3.exceptions import ConnectTimeoutError, NameResolutionError, ProtocolError
from urllib3.response import HTTPResponse
from urllib3.util.retry import Retry

from sentry import options
from sentry.auth.services.auth import AuthService
from sentry.hybridcloud.rpc.service import (
    RpcAuthenticationSetupException,
    RpcDisabledException,
    RpcRemoteException,
    RpcResponseException,
    _create_request_session,
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


@no_silo_test
@override_settings(RPC_SHARED_SECRET=["synthetic-shared-secret"], RPC_TIMEOUT=10.0)
@pytest.mark.parametrize(
    "raw,expected_data",
    [
        (
            HTTPResponse(retries=Retry(total=1)),
            {"rpc_retry_count": 0, "rpc_destination_region": "europe"},
        ),
        (
            HTTPResponse(
                retries=Retry(total=1).increment(
                    method="POST", error=ConnectTimeoutError("synthetic-private-error")
                )
            ),
            {"rpc_retry_count": 1, "rpc_destination_region": "europe"},
        ),
        (None, {}),
        (HTTPResponse(retries=None), {}),
    ],
    ids=["no-retry", "retried", "missing-raw", "missing-retries"],
)
def test_token_replica_retry_attributes_stay_on_rpc_span(
    raw: HTTPResponse | None, expected_data: dict[str, int | str]
) -> None:
    response = requests.Response()
    response.status_code = 200
    response._content = b'{"meta": {}, "value": null}'
    response.raw = raw
    rpc_span = Span(op="hybrid_cloud.dispatch_rpc")
    http_span = Span(op="http.client")
    rpc_data_before = rpc_span.to_json()["data"]
    http_data_before = http_span.to_json()["data"]
    call = _RemoteSiloCall(_CELLS[1], "region_replica", "upsert_replicated_api_token", {})

    def post(*args: Any, **kwargs: Any) -> requests.Response:
        assert sentry_sdk.get_current_span() is rpc_span
        sentry_sdk.get_current_scope().span = http_span
        return response

    with (
        sentry_sdk.new_scope(),
        mock.patch("sentry.hybridcloud.rpc.service.start_span", return_value=rpc_span),
        mock.patch("sentry.hybridcloud.rpc.service._get_connection") as connection,
        mock.patch("sentry.hybridcloud.rpc.service.monotonic", side_effect=[10.0, 10.25]),
    ):
        connection.return_value.post.side_effect = post
        assert call._send_to_remote_silo(use_test_client=False) == {"meta": {}, "value": None}

    assert rpc_span.to_json()["data"] == {**rpc_data_before, **expected_data}
    assert http_span.to_json()["data"] == http_data_before


@no_silo_test
@override_settings(RPC_TIMEOUT=1.0)
@override_options({"hybridcloud.rpc.retries": 1})
def test_token_replica_diagnostic_after_dns_retry() -> None:
    request_body = b'{"token": "synthetic-private-token"}'
    authorization = "synthetic-private-authorization"
    response_body = b'{"meta": {}, "value": null}'
    received: list[tuple[str, str | None, bytes]] = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            received.append(
                (
                    self.path,
                    self.headers.get("Authorization"),
                    self.rfile.read(int(self.headers["Content-Length"])),
                )
            )
            self.send_response(200)
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)

        def log_message(self, format: str, *args: Any) -> None:
            pass

    with HTTPServer(("127.0.0.1", 0), Handler) as server, _create_request_session(1) as http:
        server.timeout = 2
        http.trust_env = False
        host = "127.0.0.1"
        port = server.server_port
        resolved = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        call = _RemoteSiloCall(
            Cell("test-cell", 1, f"http://{host}:{port}"),
            "region_replica",
            "upsert_replicated_api_token",
            {},
        )
        thread = Thread(target=server.handle_request, daemon=True)
        thread.start()
        try:
            with (
                mock.patch("sentry.hybridcloud.rpc.service._get_connection", return_value=http),
                mock.patch(
                    "socket.getaddrinfo",
                    side_effect=[
                        socket.gaierror(socket.EAI_AGAIN, "synthetic-private-error"),
                        resolved,
                    ],
                ) as getaddrinfo,
                mock.patch("sentry.hybridcloud.rpc.service.monotonic", side_effect=[10.0, 10.25]),
                mock.patch("sentry.hybridcloud.rpc.service.logger.info") as log_info,
            ):
                response = call._fire_request({"Authorization": authorization}, request_body)
        finally:
            thread.join(timeout=3)
        assert not thread.is_alive()

        assert response.status_code == 200
        assert response.content == response_body
        assert received == [(call.path, authorization, request_body)]
        assert getaddrinfo.call_count == 2
        adapter = http.get_adapter(call.address)
        assert isinstance(adapter, HTTPAdapter)
        assert adapter.max_retries.total == 1
        retries = response.raw.retries
        assert isinstance(retries, Retry)
        history = retries.history
        assert len(history) == 1
        assert type(history[0].error) is NameResolutionError
        cause = history[0].error.__cause__
        assert isinstance(cause, socket.gaierror)
        assert cause.errno == socket.EAI_AGAIN
        log_info.assert_called_once_with(
            "hybrid_cloud.dispatch_rpc.transport_diagnostic",
            extra={
                "rpc_destination_region": "test-cell",
                "rpc_method": "region_replica.upsert_replicated_api_token",
                "rpc_retry_count": 1,
                "rpc_retry_first_error_type": "NameResolutionError",
                "rpc_retry_error_types": ["NameResolutionError"],
                "rpc_retry_first_cause_type": "gaierror",
                "rpc_retry_first_errno": socket.EAI_AGAIN,
                "rpc_request_duration_ms": 250.0,
                "rpc_request_timeout_ms": 1000.0,
            },
        )
        assert "synthetic-private" not in repr(log_info.call_args)


@no_silo_test
@override_settings(RPC_TIMEOUT=10.0)
@pytest.mark.parametrize(
    "error,cause,error_type,cause_type,error_number",
    [
        (
            ConnectTimeoutError("synthetic-private-error"),
            TimeoutError("synthetic-private-cause"),
            "ConnectTimeoutError",
            "TimeoutError",
            None,
        ),
        (
            ProtocolError(
                "synthetic-private-error",
                ConnectionResetError(errno.ECONNRESET, "synthetic-private-cause"),
            ),
            None,
            "ProtocolError",
            "ConnectionResetError",
            errno.ECONNRESET,
        ),
    ],
    ids=["connect-timeout", "connection-reset"],
)
def test_token_replica_diagnostic_preserves_retry_error_types(
    error: Exception,
    cause: Exception | None,
    error_type: str,
    cause_type: str,
    error_number: int | None,
) -> None:
    error.__cause__ = cause
    retries = Retry(total=2, allowed_methods=["POST"], status_forcelist=[503]).increment(
        method="POST",
        url="/synthetic-private-url",
        error=error,
    )
    retries = retries.increment(
        method="POST", url="/synthetic-private-url", response=HTTPResponse(status=503)
    )
    response = requests.Response()
    response.status_code = 200
    response.raw = HTTPResponse(retries=retries)
    call = _RemoteSiloCall(_CELLS[1], "region_replica", "upsert_replicated_api_token", {})
    with (
        mock.patch("sentry.hybridcloud.rpc.service._get_connection") as connection,
        mock.patch("sentry.hybridcloud.rpc.service.monotonic", side_effect=[10.0, 10.5]),
        mock.patch("sentry.hybridcloud.rpc.service.logger.info") as log_info,
    ):
        connection.return_value.post.return_value = response
        assert call._fire_request({}, b"synthetic-private-body") is response

    log_info.assert_called_once_with(
        "hybrid_cloud.dispatch_rpc.transport_diagnostic",
        extra={
            "rpc_destination_region": "europe",
            "rpc_method": "region_replica.upsert_replicated_api_token",
            "rpc_retry_count": 2,
            "rpc_retry_first_error_type": error_type,
            "rpc_retry_error_types": [error_type, "HTTP503"],
            "rpc_retry_first_cause_type": cause_type,
            "rpc_retry_first_errno": error_number,
            "rpc_request_duration_ms": 500.0,
            "rpc_request_timeout_ms": 10000.0,
        },
    )
    assert "synthetic-private" not in repr(log_info.call_args)


@no_silo_test
@override_settings(RPC_TIMEOUT=10.0)
def test_token_replica_diagnostic_for_slow_request_without_retry() -> None:
    response = requests.Response()
    response.status_code = 200
    response.raw = HTTPResponse(retries=Retry(total=1))
    call = _RemoteSiloCall(_CELLS[1], "region_replica", "upsert_replicated_api_token", {})
    with (
        mock.patch("sentry.hybridcloud.rpc.service._get_connection") as connection,
        mock.patch("sentry.hybridcloud.rpc.service.monotonic", side_effect=[10.0, 20.0]),
        mock.patch("sentry.hybridcloud.rpc.service.logger.info") as log_info,
    ):
        connection.return_value.post.return_value = response
        assert call._fire_request({}, b"") is response

    log_info.assert_called_once_with(
        "hybrid_cloud.dispatch_rpc.transport_diagnostic",
        extra={
            "rpc_destination_region": "europe",
            "rpc_method": "region_replica.upsert_replicated_api_token",
            "rpc_retry_count": 0,
            "rpc_retry_first_error_type": None,
            "rpc_retry_error_types": [],
            "rpc_retry_first_cause_type": None,
            "rpc_retry_first_errno": None,
            "rpc_request_duration_ms": 10000.0,
            "rpc_request_timeout_ms": 10000.0,
        },
    )


@no_silo_test
@override_settings(RPC_TIMEOUT=10.0)
@pytest.mark.parametrize(
    "service_name,method_name,status,duration,raw",
    [
        ("region_replica", "upsert_replicated_api_token", 200, 0.25, HTTPResponse(retries=Retry())),
        ("region_replica", "upsert_replicated_api_token", 200, 20, None),
        ("region_replica", "upsert_replicated_api_token", 200, 20, HTTPResponse(retries=None)),
        ("region_replica", "upsert_replicated_api_token", 500, 20, HTTPResponse(retries=Retry())),
        ("region_replica", "upsert_replicated_user", 200, 20, HTTPResponse(retries=Retry())),
        ("other_service", "upsert_replicated_api_token", 200, 20, HTTPResponse(retries=Retry())),
    ],
    ids=["fast", "missing-raw", "missing-retries", "non-200", "other-method", "other-service"],
)
def test_token_replica_diagnostic_ignores_unrelated_requests(
    service_name: str, method_name: str, status: int, duration: float, raw: HTTPResponse | None
) -> None:
    response = requests.Response()
    response.status_code = status
    response.raw = raw
    call = _RemoteSiloCall(_CELLS[1], service_name, method_name, {})
    with (
        mock.patch("sentry.hybridcloud.rpc.service._get_connection") as connection,
        mock.patch("sentry.hybridcloud.rpc.service.monotonic", side_effect=[10.0, 10.0 + duration]),
        mock.patch("sentry.hybridcloud.rpc.service.logger.info") as log_info,
    ):
        connection.return_value.post.return_value = response
        assert call._fire_request({}, b"") is response

    log_info.assert_not_called()


@no_silo_test
@pytest.mark.parametrize(
    "error,kind,message",
    [
        (
            requests.exceptions.ConnectionError("synthetic-private-error"),
            "connectionerror",
            "RPC Connection failed",
        ),
        (
            requests.exceptions.RetryError("synthetic-private-error"),
            "retryerror",
            "RPC failed, max retries reached.",
        ),
        (requests.exceptions.Timeout("synthetic-private-error"), "timeout", "Timeout of"),
    ],
)
def test_token_replica_diagnostic_preserves_request_errors(
    error: requests.exceptions.RequestException, kind: str, message: str
) -> None:
    call = _RemoteSiloCall(_CELLS[1], "region_replica", "upsert_replicated_api_token", {})
    span = Span(op="hybrid_cloud.dispatch_rpc")
    with (
        mock.patch("sentry.hybridcloud.rpc.service._get_connection") as connection,
        mock.patch("sentry.hybridcloud.rpc.service.logger.info") as log_info,
        mock.patch("sentry.hybridcloud.rpc.service.metrics.incr") as incr,
    ):
        connection.return_value.post.side_effect = error
        with pytest.raises(RpcRemoteException, match=message) as exc_info:
            call._fire_request({}, b"", span=span)

    assert exc_info.value.__cause__ is error
    assert "rpc_retry_count" not in span.to_json()["data"]
    assert "rpc_destination_region" not in span.to_json()["data"]
    log_info.assert_not_called()
    incr.assert_called_once_with(
        "hybrid_cloud.dispatch_rpc.failure",
        tags={
            "rpc_destination_region": "europe",
            "rpc_method": "region_replica.upsert_replicated_api_token",
            "kind": kind,
        },
    )
