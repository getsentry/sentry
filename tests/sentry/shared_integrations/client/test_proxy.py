from django.test import override_settings
from requests import Request

from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils import TestCase

control_address = "https://sentry.io"
secret = "hush-hush-im-invisible"


@override_settings(
    SENTRY_SUBNET_SECRET=secret,
    SENTRY_CONTROL_ADDRESS=control_address,
)
class IntegrationProxyClientTest(TestCase):
    def setUp(self):
        class TestClient(IntegrationProxyClient):
            integration_type = "integration"
            integration_name = "test"
            base_url = "https://example.com"

        self.client_cls = TestClient
        self.oi_id = 24

    def test_finalize_request_noop(self):
        """Only applies proxy details if the request originates from a region silo."""
        prepared_request = Request(method="GET", url="https://example.com/get").prepare()
        raw_url = prepared_request.url
        raw_headers = prepared_request.headers
        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = self.client_cls(org_integration_id=self.oi_id)
            client.finalize_request(prepared_request)
            assert raw_url == prepared_request.url
            assert prepared_request.headers == raw_headers
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = self.client_cls(org_integration_id=self.oi_id)
            client.finalize_request(prepared_request)
            assert raw_url == prepared_request.url
            assert prepared_request.headers == raw_headers

    @override_settings(SILO_MODE=SiloMode.REGION)
    def test_finalize_request_region(self):
        """In a region silo, should change the URL and headers"""
        prepared_request = Request(method="GET", url="https://example.com/get").prepare()
        raw_url = prepared_request.url
        raw_headers = prepared_request.headers
        for header in [PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER]:
            assert header not in raw_headers

        client = self.client_cls(org_integration_id=self.oi_id)
        client.finalize_request(prepared_request)
        assert prepared_request.url != raw_url
        for header in [PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER]:
            assert header in prepared_request.headers
