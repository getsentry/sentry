from unittest.mock import patch

from django.test import override_settings
from requests import Request

from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils import TestCase

control_address = "http://controlserver"
secret = "hush-hush-im-invisible"


@override_settings(SENTRY_SUBNET_SECRET=secret, SENTRY_CONTROL_ADDRESS=control_address)
class IntegrationProxyClientTest(TestCase):
    def setUp(self):
        class TestClient(IntegrationProxyClient):
            integration_type = "integration"
            integration_name = "test"
            base_url = "https://example.com"
            _use_proxy_url_for_tests = True

        self.client_cls = TestClient
        self.oi_id = 24

    def test_authorize_request_noop(self):
        prepared_request = Request(method="GET", url="https://example.com/get").prepare()
        raw_headers = prepared_request.headers
        client = self.client_cls(org_integration_id=self.oi_id)
        client.authorize_request(prepared_request)
        assert prepared_request.headers == raw_headers

    def test_authorize_request_basic(self):
        prepared_request = Request(method="GET", url="https://example.com/get").prepare()

        def authorize_request(prepared_request):
            prepared_request.headers["Authorization"] = "Bearer tkn"
            return prepared_request

        client = self.client_cls(org_integration_id=self.oi_id)
        client.authorize_request = authorize_request

        assert prepared_request.headers == {}
        client.authorize_request(prepared_request)
        assert prepared_request.headers == {"Authorization": "Bearer tkn"}

    @patch.object(IntegrationProxyClient, "authorize_request")
    def test_finalize_request_noop(self, mock_authorize):
        """Only applies proxy details if the request originates from a region silo."""
        prepared_request = Request(method="GET", url="https://example.com/get").prepare()
        raw_url = prepared_request.url
        raw_headers = prepared_request.headers
        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = self.client_cls(org_integration_id=self.oi_id)
            client.finalize_request(prepared_request)
            assert mock_authorize.called
            assert raw_url == prepared_request.url
            assert prepared_request.headers == raw_headers
        mock_authorize.reset_mock()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = self.client_cls(org_integration_id=self.oi_id)
            client.finalize_request(prepared_request)
            assert mock_authorize.called
            assert raw_url == prepared_request.url
            assert prepared_request.headers == raw_headers

    @patch.object(IntegrationProxyClient, "authorize_request")
    @override_settings(SILO_MODE=SiloMode.REGION)
    def test_finalize_request_region(self, mock_authorize):
        """In a region silo, should change the URL and headers"""
        prepared_request = Request(method="GET", url="https://example.com/get").prepare()
        raw_url = prepared_request.url
        raw_headers = prepared_request.headers
        for header in [PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER]:
            assert header not in raw_headers

        client = self.client_cls(org_integration_id=self.oi_id)
        client.finalize_request(prepared_request)
        assert not mock_authorize.called
        assert prepared_request.url != raw_url
        for header in [PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER]:
            assert header in prepared_request.headers
