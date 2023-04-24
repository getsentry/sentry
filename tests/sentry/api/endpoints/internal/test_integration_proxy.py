from unittest.mock import MagicMock, Mock, patch

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
    PROXY_TIMESTAMP_HEADER,
    encode_subnet_signature,
)
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test


def create_cgi_header_name(header: str):
    """
    Django requests cannot be initialized without request factory, and headers for those requests
    must follow the CGI spec. This means _ (instead of -) and prefixed with 'HTTP_'

    https://docs.djangoproject.com/en/4.0/topics/testing/tools/#making-requests
    """
    return f"{HttpHeaders.HTTP_PREFIX}{header.replace('-','_')}"


@control_silo_test()
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

        timestamp = "1682360247791"
        signature = encode_subnet_signature(
            secret=self.secret,
            timestamp=timestamp,
            path=self.proxy_path,
            identifier=str(self.org_integration.id),
            request_body=b"",
        )
        self.valid_header_kwargs = {
            create_cgi_header_name(PROXY_TIMESTAMP_HEADER): timestamp,
            create_cgi_header_name(PROXY_SIGNATURE_HEADER): signature,
            create_cgi_header_name(PROXY_OI_HEADER): str(self.org_integration.id),
        }
        self.valid_request = self.factory.get(self.path, **self.valid_header_kwargs)

    @patch.object(InternalIntegrationProxyEndpoint, "client")
    @patch.object(InternalIntegrationProxyEndpoint, "_should_operate", return_value=True)
    def test_proxy(self, mock_should_operate, mock_client):
        mock_response = Mock(spec=Response)
        mock_response.content = str({"some": "data"}).encode("utf-8")
        mock_response.status_code = 400
        mock_response.reason = "Bad Request"
        mock_response.headers = {"Content-Type": "application/json"}

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client._request = MagicMock(return_value=mock_response)

        assert not mock_client.authorize_request.called
        assert not mock_client._request.called
        proxy_response = self.client.get(self.path, **self.valid_header_kwargs)
        assert mock_client.authorize_request.called
        assert mock_client._request.called

        assert proxy_response.content == mock_response.content
        assert proxy_response.status_code == mock_response.status_code
        assert proxy_response._reason_phrase == mock_response.reason
        assert proxy_response.get("Content-Type", "") == mock_response.headers.get("Content-Type")

    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test__validate_sender(self):
        # Missing header data
        header_kwargs = {}
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_sender(request)

        # Bad header data
        header_kwargs = {
            create_cgi_header_name(PROXY_TIMESTAMP_HEADER): "bad",
            create_cgi_header_name(PROXY_SIGNATURE_HEADER): "data",
            create_cgi_header_name(PROXY_OI_HEADER): "present",
        }
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_sender(request)

        # Success
        assert self.endpoint_cls._validate_sender(self.valid_request)

    @patch.object(Integration, "get_installation")
    @override_settings(
        SENTRY_SUBNET_SECRET=secret,
        SILO_MODE=SiloMode.CONTROL,
        SENTRY_CONTROL_ADDRESS="https://sentry.io",
    )
    def test__validate_request(self, mock_get_installation):
        # Missing header data
        request = self.factory.get(self.path)
        assert not self.endpoint_cls._validate_request(request)

        # Invalid organization integration
        self.org_integration.update(status=ObjectStatus.DISABLED)
        header_kwargs = {
            create_cgi_header_name(PROXY_OI_HEADER): str(self.org_integration.id),
        }
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
