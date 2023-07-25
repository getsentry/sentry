from __future__ import annotations

from typing import TypedDict
from unittest.mock import MagicMock, Mock, patch

from django.http import HttpResponse, JsonResponse
from django.http.request import HttpHeaders
from django.test import RequestFactory, override_settings
from requests import Response

from sentry.api.endpoints.internal.integration_proxy import InternalIntegrationProxyEndpoint
from sentry.constants import ObjectStatus
from sentry.integrations.client import ApiClient
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    PROXY_BASE_PATH,
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
    encode_subnet_signature,
)
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


class SiloHttpHeaders(TypedDict, total=False):
    HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION: str
    HTTP_X_SENTRY_SUBNET_SIGNATURE: str


def test_ensure_http_headers_match() -> None:
    headers = SiloHttpHeaders(
        HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION="hello",
        HTTP_X_SENTRY_SUBNET_SIGNATURE="world",
    )

    def cgi_header(s: str) -> str:
        """
        Django requests cannot be initialized without request factory, and headers for those requests
        must follow the CGI spec. This means _ (instead of -) and prefixed with 'HTTP_'

        https://docs.djangoproject.com/en/4.0/topics/testing/tools/#making-requests
        """
        return f"{HttpHeaders.HTTP_PREFIX}{s.replace('-','_')}".upper()

    expected = {cgi_header(s) for s in (PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER)}
    assert set(headers) == expected


@control_silo_test(stable=True)
class InternalIntegrationProxyEndpointTest(APITestCase):
    endpoint = "sentry-api-0-internal-integration-proxy"
    secret = "hush-hush-im-invisible"

    def setUp(self):
        self.factory = RequestFactory()
        self.proxy_path = "chat.postMessage"
        self.endpoint_cls = InternalIntegrationProxyEndpoint()
        self.endpoint_cls.proxy_path = self.proxy_path
        self.path = f"{PROXY_BASE_PATH}/{self.proxy_path}"
        self.integration = self.create_integration(
            self.organization, external_id="example:1", provider="example"
        )
        self.org_integration = OrganizationIntegration.objects.filter(
            integration_id=self.integration.id
        ).first()

        signature = encode_subnet_signature(
            secret=self.secret,
            base_url="https://example.com/api",
            path=self.proxy_path,
            identifier=str(self.org_integration.id),
            request_body=b"",
        )
        self.valid_header_kwargs = SiloHttpHeaders(
            HTTP_X_SENTRY_SUBNET_BASE_URL="https://example.com/api",
            HTTP_X_SENTRY_SUBNET_SIGNATURE=signature,
            HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION=str(self.org_integration.id),
        )
        self.valid_request = self.factory.get(self.path, **self.valid_header_kwargs)

    @patch.object(InternalIntegrationProxyEndpoint, "client")
    @patch.object(InternalIntegrationProxyEndpoint, "_should_operate", return_value=True)
    def test_proxy(self, mock_should_operate, mock_client):
        mock_response = Mock(spec=Response)
        mock_response.content = str({"some": "data"}).encode("utf-8")
        mock_response.status_code = 400
        mock_response.reason = "Bad Request"
        mock_response.headers = {
            "Content-Type": "application/json",
            "X-Arbitrary": "Value",
            PROXY_SIGNATURE_HEADER: "123",
        }

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client._request = MagicMock(return_value=mock_response)
        mock_client.should_delegate = MagicMock(return_value=False)

        proxy_response = self.client.get(self.path, **self.valid_header_kwargs)
        assert mock_should_operate.called
        assert mock_client._request.called

        assert proxy_response.content == mock_response.content
        assert proxy_response.status_code == mock_response.status_code
        assert proxy_response.reason_phrase == mock_response.reason
        assert proxy_response["Content-Type"] == mock_response.headers["Content-Type"]
        assert proxy_response["X-Arbitrary"] == mock_response.headers["X-Arbitrary"]
        assert proxy_response.get(PROXY_SIGNATURE_HEADER) is None

    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test__validate_sender(self):
        # Missing header data
        header_kwargs = SiloHttpHeaders()
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_sender(request)

        # Bad header data
        header_kwargs = SiloHttpHeaders(
            HTTP_X_SENTRY_SUBNET_SIGNATURE="data",
            HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION="present",
        )
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_sender(request)

        # Success
        assert self.endpoint_cls._validate_sender(self.valid_request)

    @patch.object(Integration, "get_installation")
    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test__validate_request(self, mock_get_installation):
        # Missing header data
        request = self.factory.get(self.path)
        assert not self.endpoint_cls._validate_request(request)

        # Invalid organization integration
        self.org_integration.update(status=ObjectStatus.DISABLED)
        header_kwargs = SiloHttpHeaders(
            HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION=str(self.org_integration.id),
        )
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_request(request)

        # Invalid integration
        self.org_integration.update(status=ObjectStatus.ACTIVE)
        self.integration.update(status=ObjectStatus.DISABLED)
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_request(request)

        # Invalid client
        self.integration.update(status=ObjectStatus.ACTIVE)
        mock_get_installation().get_client = MagicMock(return_value=ApiClient())
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_request(request)

        # Success
        mock_get_installation().get_client = MagicMock(
            return_value=IntegrationProxyClient(org_integration_id=self.org_integration.id)
        )
        request = self.factory.get(self.path, **header_kwargs)
        assert self.endpoint_cls._validate_request(request)

    @patch.object(Integration, "get_installation")
    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test_proxy_with_client_delegate(self, mock_get_installation):
        expected_proxy_payload = {
            "args": ["hello"],
            "kwargs": {"function_name": "lambdaE"},
            "function_name": "get_function",
        }

        class TestProxyClient(IntegrationProxyClient):
            integration_name = "test_proxy_client"

            def __init__(self, org_integration_id: int | None) -> None:
                super().__init__(org_integration_id=org_integration_id)

            def should_delegate(self) -> bool:
                return True

            def delegate(self, request, proxy_path: str, headers) -> HttpResponse:
                assert expected_proxy_payload == request.data
                return JsonResponse(
                    data={
                        "function_name": "get_function",
                        "return_response": {"hello": "world"},
                    },
                    status=200,
                )

        mock_get_installation().get_client = MagicMock(
            return_value=TestProxyClient(org_integration_id=self.org_integration.id)
        )

        signature = encode_subnet_signature(
            secret=self.secret,
            base_url="https://example.com/api",
            path="",
            identifier=str(self.org_integration.id),
            request_body=json.dumps(expected_proxy_payload).encode("utf-8"),
        )
        headers = SiloHttpHeaders(
            HTTP_X_SENTRY_SUBNET_BASE_URL="https://example.com/api",
            HTTP_X_SENTRY_SUBNET_SIGNATURE=signature,
            HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION=str(self.org_integration.id),
        )
        proxy_response = self.client.post(
            f"{PROXY_BASE_PATH}/", **headers, data=expected_proxy_payload, format="json"
        )

        actual_response_payload = json.loads(proxy_response.content)
        assert actual_response_payload == {
            "function_name": "get_function",
            "return_response": {"hello": "world"},
        }
