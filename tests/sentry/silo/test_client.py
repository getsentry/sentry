from unittest.mock import patch

import responses
from django.test import RequestFactory, override_settings
from pytest import raises

from sentry.shared_integrations.exceptions import ApiHostError
from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.silo import SiloMode
from sentry.silo.client import RegionSiloClient, SiloClientError, validate_region_ip_address
from sentry.silo.util import PROXY_DIRECT_LOCATION_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import override_allowed_region_silo_ip_addresses
from sentry.testutils.region import override_regions
from sentry.types.region import Region, RegionCategory, RegionResolutionError
from sentry.utils import json


class SiloClientTest(TestCase):
    dummy_address = "http://eu.testserver"
    region = Region("eu", 1, dummy_address, RegionCategory.MULTI_TENANT)
    region_config = (region,)

    def setUp(self):
        self.factory = RequestFactory()

    @override_settings(SILO_MODE=SiloMode.MONOLITH)
    def test_init_clients_from_monolith(self):
        with raises(SiloClientError):
            RegionSiloClient(self.region)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_init_clients_from_control(self):
        with override_regions(self.region_config):
            with raises(SiloClientError):
                RegionSiloClient("atlantis")  # type: ignore[arg-type]

            with raises(RegionResolutionError):
                region = Region("atlantis", 1, self.dummy_address, RegionCategory.MULTI_TENANT)
                RegionSiloClient(region)

            client = RegionSiloClient(self.region)
            assert client.base_url is not None
            assert self.region.address in client.base_url

    @override_settings(SILO_MODE=SiloMode.REGION)
    @override_settings(SENTRY_CONTROL_ADDRESS=dummy_address)
    def test_init_clients_from_region(self):
        with raises(SiloClientError):
            RegionSiloClient(self.region)

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_client_request(self):
        with override_regions(self.region_config):
            client = RegionSiloClient(self.region)
            path = "/api/0/imaginary-public-endpoint/"
            responses.add(
                responses.GET,
                f"{self.dummy_address}{path}",
                json={"ok": True},
            )

            response = client.request("GET", path)
            assert isinstance(response, BaseApiResponse)

            assert response.status_code == 200
            assert response.body.get("ok")

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_client_proxy_request(self):
        with override_regions(self.region_config):
            client = RegionSiloClient(self.region)
            path = f"{self.dummy_address}/api/0/imaginary-public-endpoint/"
            responses.add(
                responses.GET,
                path,
                json={"ok": True},
                headers={"X-Some-Header": "Some-Value", PROXY_SIGNATURE_HEADER: "123"},
            )

            request = self.factory.get(path, HTTP_HOST="https://control.sentry.io")
            response = client.proxy_request(request)

            assert response.status_code == 200
            assert json.loads(response.content).get("ok")

            assert response["X-Some-Header"] == "Some-Value"
            assert response.get(PROXY_SIGNATURE_HEADER) is None
            assert response[PROXY_DIRECT_LOCATION_HEADER] == path

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_invalid_region_silo_ip_address(self):
        internal_region_address = "http://172.31.255.31:9000"
        region = Region("eu", 1, internal_region_address, RegionCategory.MULTI_TENANT)
        region_config = (region,)

        # Disallow any region silo ip address by default.
        with override_regions(region_config), patch(
            "sentry_sdk.capture_exception"
        ) as mock_capture_exception, raises(ApiHostError):
            assert mock_capture_exception.call_count == 0

            client = RegionSiloClient(region)
            path = f"{internal_region_address}/api/0/imaginary-public-endpoint/"
            request = self.factory.get(path, HTTP_HOST="https://control.sentry.io")
            client.proxy_request(request)

            assert mock_capture_exception.call_count == 1
            err = mock_capture_exception.call_args.args[0]
            assert isinstance(err, RegionResolutionError)
            assert err.args == ("Disallowed Region Silo IP address: 172.31.255.31",)

        with override_regions(region_config), patch(
            "sentry_sdk.capture_exception"
        ) as mock_capture_exception, override_allowed_region_silo_ip_addresses(
            "172.31.255.255"
        ), raises(
            ApiHostError
        ):
            assert mock_capture_exception.call_count == 0

            client = RegionSiloClient(region)
            path = f"{internal_region_address}/api/0/imaginary-public-endpoint/"
            request = self.factory.get(path, HTTP_HOST="https://control.sentry.io")
            client.proxy_request(request)

            assert mock_capture_exception.call_count == 1
            err = mock_capture_exception.call_args.args[0]
            assert isinstance(err, RegionResolutionError)
            assert err.args == ("Disallowed Region Silo IP address: 172.31.255.31",)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_allowed_region_silo_ip_addresses("172.31.255.255")
    def test_client_restricted_ip_address(self):
        internal_region_address = "http://172.31.255.255:9000"
        region = Region("eu", 1, internal_region_address, RegionCategory.MULTI_TENANT)
        region_config = (region,)

        with override_regions(region_config), patch(
            "sentry.silo.client.validate_region_ip_address"
        ) as mock_validate_region_ip_address:
            client = RegionSiloClient(region)
            path = f"{internal_region_address}/api/0/imaginary-public-endpoint/"
            request = self.factory.get(path, HTTP_HOST="https://control.sentry.io")

            class BailOut(Exception):
                pass

            def test_validate_region_ip_address(ip):
                assert ip == "172.31.255.255"
                # We can't use responses library for this unit test as it hooks Session.send. So we assert that the
                # validate_region_ip_address function is properly called for the proxy request code path.
                raise BailOut()

            mock_validate_region_ip_address.side_effect = test_validate_region_ip_address

            assert mock_validate_region_ip_address.call_count == 0
            with raises(BailOut):
                client.proxy_request(request)
                assert mock_validate_region_ip_address.call_count == 1


def test_validate_region_ip_address():
    with patch(
        "sentry_sdk.capture_exception"
    ) as mock_capture_exception, override_allowed_region_silo_ip_addresses():
        assert validate_region_ip_address("172.31.255.255") is False
        assert mock_capture_exception.call_count == 1
        err = mock_capture_exception.call_args.args[0]
        assert isinstance(err, RegionResolutionError)
        assert err.args == ("Disallowed Region Silo IP address: 172.31.255.255",)

    with patch(
        "sentry_sdk.capture_exception"
    ) as mock_capture_exception, override_allowed_region_silo_ip_addresses("192.88.99.0"):
        assert validate_region_ip_address("172.31.255.255") is False
        assert mock_capture_exception.call_count == 1
        err = mock_capture_exception.call_args.args[0]
        assert isinstance(err, RegionResolutionError)
        assert err.args == ("Disallowed Region Silo IP address: 172.31.255.255",)

    with patch(
        "sentry_sdk.capture_exception"
    ) as mock_capture_exception, override_allowed_region_silo_ip_addresses(
        "192.88.99.0", "172.31.255.255"
    ):
        assert validate_region_ip_address("172.31.255.255") is True
        assert mock_capture_exception.call_count == 0
