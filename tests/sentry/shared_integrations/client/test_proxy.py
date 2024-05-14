import ipaddress
from unittest.mock import MagicMock, patch

from django.test import override_settings
from pytest import raises
from requests import Request

from sentry.constants import ObjectStatus
from sentry.net.http import Session
from sentry.shared_integrations.client.proxy import (
    IntegrationProxyClient,
    get_control_silo_ip_address,
    infer_org_integration,
)
from sentry.shared_integrations.exceptions import ApiHostError
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_OI_HEADER, PROXY_PATH, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode

control_address = "http://controlserver"


class IntegrationProxyClientTest(TestCase):
    oi_id = 24
    base_url = "https://example.com"
    test_url = f"{base_url}/get?query=1&user=me"

    def setUp(self):
        class TestClient(IntegrationProxyClient):
            integration_type = "integration"
            integration_name = "test"
            base_url = self.base_url
            _use_proxy_url_for_tests = True

        self.client_cls = TestClient

    def test_infer_organization_is_active(self):
        integration = self.create_provider_integration(provider="slack", external_id="workspace:1")
        # Share the slack workspace across two organizations
        organization_invalid = self.create_organization()
        organization_valid = self.create_organization()
        # Create a valid one, and an invalid one
        org_integration_invalid = self.create_organization_integration(
            integration_id=integration.id,
            organization_id=organization_invalid.id,
            status=ObjectStatus.DISABLED,
        )
        org_integration_valid = self.create_organization_integration(
            integration_id=integration.id,
            organization_id=organization_valid.id,
            status=ObjectStatus.ACTIVE,
        )
        # Infer should always look for the first ACTIVE organization_integration
        assert infer_org_integration(integration_id=integration.id) == org_integration_valid.id
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration_valid.delete()
        second_inference = infer_org_integration(integration_id=integration.id)
        assert second_inference is not org_integration_invalid.id
        assert second_inference is None

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_authorize_request_noop(self):
        prepared_request = Request(method="GET", url=self.test_url).prepare()
        raw_headers = prepared_request.headers
        client = self.client_cls(org_integration_id=self.oi_id)
        client.authorize_request(prepared_request)
        assert prepared_request.headers == raw_headers

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_authorize_request_basic(self):
        prepared_request = Request(method="POST", url=self.test_url).prepare()

        def authorize_request(prepared_request):
            prepared_request.headers["Authorization"] = "Bearer tkn"
            return prepared_request

        client = self.client_cls(org_integration_id=self.oi_id)
        client.authorize_request = authorize_request

        assert prepared_request.headers.get("Authorization") is None
        client.authorize_request(prepared_request)
        assert prepared_request.headers.get("Authorization") == "Bearer tkn"

    @patch.object(IntegrationProxyClient, "authorize_request")
    def test_finalize_request_noop(self, mock_authorize):
        """Only applies proxy details if the request originates from a region silo."""
        prepared_request = Request(method="PATCH", url=self.test_url).prepare()
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
    def test_finalize_request_region(self, mock_authorize):
        """In a region silo, should change the URL and headers"""
        prepared_request = Request(method="DELETE", url=self.test_url).prepare()
        raw_url = prepared_request.url
        raw_headers = prepared_request.headers
        for header in [PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER, PROXY_PATH]:
            assert header not in raw_headers

        client = self.client_cls(org_integration_id=self.oi_id)
        client.finalize_request(prepared_request)
        assert not mock_authorize.called
        assert prepared_request.url != raw_url
        assert prepared_request.url == "http://controlserver/api/0/internal/integration-proxy/"
        for header in [PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER, PROXY_PATH]:
            assert header in prepared_request.headers
        assert prepared_request.headers[PROXY_PATH] == "get?query=1&user=me"

    @patch("sentry.shared_integrations.client.proxy.get_control_silo_ip_address")
    @patch("socket.getaddrinfo")
    def test_invalid_control_silo_ip_address(
        self, mock_getaddrinfo, mock_get_control_silo_ip_address
    ):
        with patch("sentry_sdk.capture_exception") as mock_capture_exception, raises(ApiHostError):
            mock_get_control_silo_ip_address.return_value = ipaddress.ip_address("127.0.0.1")
            mock_getaddrinfo.return_value = [(2, 1, 6, "", ("172.31.255.255", 0))]
            client = self.client_cls(org_integration_id=self.oi_id)

            client.get(f"{self.base_url}/some/endpoint", params={"query": 1, "user": "me"})

        assert mock_capture_exception.call_count == 1
        err = mock_capture_exception.call_args.args[0]
        assert err.args == ("Disallowed Control Silo IP address: 172.31.255.255",)

    @patch("sentry.shared_integrations.client.proxy.is_control_silo_ip_address")
    @patch("sentry.shared_integrations.client.proxy.get_control_silo_ip_address")
    @patch("socket.getaddrinfo")
    def test_valid_control_silo_ip_address(
        self, mock_getaddrinfo, mock_get_control_silo_ip_address, mock_is_control_silo_ip_address
    ):
        mock_get_control_silo_ip_address.return_value = ipaddress.ip_address("172.31.255.255")
        mock_getaddrinfo.return_value = [(2, 1, 6, "", ("172.31.255.255", 0))]
        client = self.client_cls(org_integration_id=self.oi_id)

        class BailOut(Exception):
            pass

        def test_is_control_silo_ip_address(ip):
            assert ip == "172.31.255.255"
            # We can't use responses library for this unit test as it hooks Session.send. So we assert that the
            # is_control_silo_ip_address function is properly called.
            raise BailOut()

        mock_is_control_silo_ip_address.side_effect = test_is_control_silo_ip_address

        with raises(BailOut):
            client.get(f"{self.base_url}/some/endpoint", params={"query": 1, "user": "me"})
        assert mock_is_control_silo_ip_address.call_count == 1

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.shared_integrations.client.proxy.is_control_silo_ip_address")
    @patch("sentry.shared_integrations.client.proxy.get_control_silo_ip_address")
    @patch("socket.getaddrinfo")
    def test_does_not_validate_control_silo_ip_address_in_control(
        self, mock_getaddrinfo, mock_get_control_silo_ip_address, mock_is_control_silo_ip_address
    ):
        mock_get_control_silo_ip_address.return_value = ipaddress.ip_address("172.31.255.255")
        mock_getaddrinfo.return_value = [(2, 1, 6, "", ("172.31.255.255", 0))]
        client = self.client_cls(org_integration_id=self.oi_id)

        class BailOut(Exception):
            pass

        def test_socket_connection(*args, **kwargs):
            # We can't use responses library for this unit test as it hooks Session.send. So we assert that the
            # socket connection is being opened.
            raise BailOut()

        with patch("socket.socket") as mock_socket, raises(BailOut):
            mock_socket.side_effect = test_socket_connection
            client.get(f"{self.base_url}/some/endpoint", params={"query": 1, "user": "me"})

        # Assert control silo ip address was not validated
        assert mock_get_control_silo_ip_address.call_count == 0
        assert mock_is_control_silo_ip_address.call_count == 0

    @patch.object(Session, "send")
    def test_custom_timeout(self, mock_session_send):
        client = self.client_cls(org_integration_id=self.oi_id)
        response = MagicMock()
        response.status_code = 204
        mock_session_send.return_value = response

        client.get(f"{self.base_url}/some/endpoint", params={"query": 1, "user": "me"})
        assert mock_session_send.call_count == 1
        assert mock_session_send.mock_calls[0].kwargs["timeout"] == 10


def test_get_control_silo_ip_address():
    with override_settings(SENTRY_CONTROL_ADDRESS=None):
        assert get_control_silo_ip_address() is None

    with override_settings(SENTRY_CONTROL_ADDRESS=control_address):
        get_control_silo_ip_address.cache_clear()
        with patch("socket.gethostbyname") as mock_gethostbyname, patch(
            "sentry_sdk.capture_exception"
        ) as mock_capture_exception:
            mock_gethostbyname.return_value = "172.31.255.255"
            assert get_control_silo_ip_address() == ipaddress.ip_address("172.31.255.255")
            assert mock_capture_exception.call_count == 0

        get_control_silo_ip_address.cache_clear()
        with patch("socket.gethostbyname") as mock_gethostbyname, patch(
            "urllib3.util.parse_url"
        ) as mock_parse_url, patch("sentry_sdk.capture_exception") as mock_capture_exception:
            mock_parse_url.return_value = MagicMock(host=None)
            assert get_control_silo_ip_address() is None
            assert mock_gethostbyname.call_count == 0
            assert mock_capture_exception.call_count == 1

            err = mock_capture_exception.call_args.args[0]
            assert err.args == (
                f"Unable to parse hostname of control silo address: {control_address}",
            )
