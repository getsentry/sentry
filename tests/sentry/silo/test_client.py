import ipaddress
from hashlib import sha1
from unittest import mock
from unittest.mock import MagicMock, patch

import responses
from django.test import RequestFactory, override_settings
from pytest import raises

from sentry.shared_integrations.exceptions import ApiError, ApiHostError
from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.silo import SiloMode
from sentry.silo.client import (
    CACHE_TIMEOUT,
    REQUEST_ATTEMPTS_LIMIT,
    RegionSiloClient,
    SiloClientError,
    get_region_ip_addresses,
    validate_region_ip_address,
)
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
    @mock.patch("sentry.silo.client.cache")
    def test_client_request_success(self, mock_cache):
        with override_regions(self.region_config):
            client = RegionSiloClient(self.region)
            path = "/api/0/imaginary-public-endpoint/"
            responses.add(
                responses.GET,
                f"{self.dummy_address}{path}",
                json={"ok": True},
            )

            response = client.request("GET", path)

            assert len(responses.calls) == 1
            assert isinstance(response, BaseApiResponse)

            assert response.status_code == 200
            assert response.body.get("ok")

            assert mock_cache.get.call_count == 0
            assert mock_cache.set.call_count == 0
            assert mock_cache.delete.call_count == 0

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @mock.patch("sentry.silo.client.cache")
    def test_client_request_success_with_retry(self, mock_cache):
        with override_regions(self.region_config):
            client = RegionSiloClient(self.region)
            path = "/api/0/imaginary-public-endpoint/"
            responses.add(
                responses.GET,
                f"{self.dummy_address}{path}",
                json={"ok": True},
            )
            prefix_hash = "123"

            response = client.request("GET", path, prefix_hash=prefix_hash)

            assert len(responses.calls) == 1
            assert isinstance(response, BaseApiResponse)

            assert response.status_code == 200
            assert response.body.get("ok")

            assert mock_cache.get.call_count == 0
            assert mock_cache.set.call_count == 0
            assert mock_cache.delete.call_count == 1

            hash = sha1(f"{prefix_hash}{self.region.name}GET{path}".encode()).hexdigest()
            cache_key = f"region_silo_client:request_attempts:{hash}"
            mock_cache.delete.assert_called_with(cache_key)

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @mock.patch("sentry.silo.client.cache")
    def test_client_request_retry_limit_reached(self, mock_cache):
        with override_regions(self.region_config):
            client = RegionSiloClient(self.region)
            path = "/api/0/imaginary-public-endpoint/"
            responses.add(
                responses.POST,
                f"{self.dummy_address}{path}",
                json={"error": "bad request"},
                status=400,
            )

            prefix_hash = "123"
            hash = sha1(f"{prefix_hash}{self.region.name}POST{path}".encode()).hexdigest()
            cache_key = f"region_silo_client:request_attempts:{hash}"
            num_of_request_attempts = 0

            while True:
                if num_of_request_attempts > REQUEST_ATTEMPTS_LIMIT:
                    assert False, "Request attempts limit not captured"

                mock_cache.reset_mock()
                responses.calls.reset()

                if num_of_request_attempts == 0:
                    mock_cache.get.return_value = None
                else:
                    mock_cache.get.return_value = num_of_request_attempts

                parent_mock = mock.Mock()
                parent_mock.attach_mock(mock_cache.get, "cache_get")
                parent_mock.attach_mock(mock_cache.set, "cache_set")
                parent_mock.attach_mock(mock_cache.delete, "cache_delete")

                if num_of_request_attempts == REQUEST_ATTEMPTS_LIMIT:
                    with raises(SiloClientError) as exception_info:
                        client.request("POST", path, prefix_hash=prefix_hash)
                    assert len(responses.calls) == 1
                    assert (
                        exception_info.value.args[0]
                        == f"Request attempts limit reached for: POST {path}"
                    )

                    assert mock_cache.get.call_count == 1
                    assert mock_cache.set.call_count == 0
                    assert mock_cache.delete.call_count == 1

                    # Assert order of cache method calls
                    expected_calls = [
                        mock.call.cache_get(cache_key),
                        mock.call.cache_delete(cache_key),
                    ]
                    assert parent_mock.mock_calls == expected_calls
                    return
                else:
                    with raises(ApiError):
                        client.request("POST", path, prefix_hash=prefix_hash)
                    assert len(responses.calls) == 1
                    resp = responses.calls[0].response
                    assert resp.status_code == 400

                    num_of_request_attempts += 1

                    assert mock_cache.get.call_count == 1
                    assert mock_cache.set.call_count == 1
                    assert mock_cache.delete.call_count == 0

                    # Assert order of cache method calls
                    expected_calls = [
                        mock.call.cache_get(cache_key),
                        mock.call.cache_set(
                            cache_key, num_of_request_attempts, timeout=CACHE_TIMEOUT
                        ),
                    ]
                    assert parent_mock.mock_calls == expected_calls

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @mock.patch("sentry.silo.client.cache")
    def test_client_request_retry_within_limit(self, mock_cache):
        with override_regions(self.region_config):
            client = RegionSiloClient(self.region)
            path = "/api/0/imaginary-public-endpoint/"
            responses.add(
                responses.POST,
                f"{self.dummy_address}{path}",
                json={"error": "bad request"},
                status=400,
            )

            prefix_hash = "123"
            hash = sha1(f"{prefix_hash}{self.region.name}POST{path}".encode()).hexdigest()
            cache_key = f"region_silo_client:request_attempts:{hash}"
            num_of_request_attempts = 0

            while True:
                mock_cache.reset_mock()
                responses.calls.reset()

                if num_of_request_attempts == (REQUEST_ATTEMPTS_LIMIT - 1):
                    responses.replace(
                        responses.POST,
                        f"{self.region.address}{path}",
                        status=200,
                        json={"ok": True},
                    )
                if num_of_request_attempts == 0:
                    mock_cache.get.return_value = None
                else:
                    mock_cache.get.return_value = num_of_request_attempts

                parent_mock = mock.Mock()
                parent_mock.attach_mock(mock_cache.get, "cache_get")
                parent_mock.attach_mock(mock_cache.set, "cache_set")
                parent_mock.attach_mock(mock_cache.delete, "cache_delete")

                if num_of_request_attempts == (REQUEST_ATTEMPTS_LIMIT - 1):
                    client.request("POST", path, prefix_hash=prefix_hash)
                    assert len(responses.calls) == 1

                    assert mock_cache.get.call_count == 0
                    assert mock_cache.set.call_count == 0
                    assert mock_cache.delete.call_count == 1

                    # Assert order of cache method calls
                    expected_calls = [
                        mock.call.cache_delete(cache_key),
                    ]
                    assert parent_mock.mock_calls == expected_calls
                    return
                else:
                    with raises(ApiError):
                        client.request("POST", path, prefix_hash=prefix_hash)

                    assert len(responses.calls) == 1
                    resp = responses.calls[0].response
                    assert resp.status_code == 400

                    num_of_request_attempts += 1

                    assert mock_cache.get.call_count == 1
                    assert mock_cache.set.call_count == 1
                    assert mock_cache.delete.call_count == 0

                    # Assert order of cache method calls
                    expected_calls = [
                        mock.call.cache_get(cache_key),
                        mock.call.cache_set(
                            cache_key, num_of_request_attempts, timeout=CACHE_TIMEOUT
                        ),
                    ]
                    assert parent_mock.mock_calls == expected_calls

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_client_request_on_3xx(self):
        with override_regions(self.region_config):
            client = RegionSiloClient(self.region)
            path = "/api/0/imaginary-public-endpoint/"
            responses.add(
                responses.POST,
                f"{self.dummy_address}{path}",
                json={"error": "redirect"},
                status=300,
            )

            response = client.request("POST", path)
            assert isinstance(response, BaseApiResponse)

            assert response.status_code == 300
            assert response.json == {"error": "redirect"}

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_client_request_on_4xx(self):
        with override_regions(self.region_config):
            client = RegionSiloClient(self.region)
            path = "/api/0/imaginary-public-endpoint/"
            responses.add(
                responses.POST,
                f"{self.dummy_address}{path}",
                json={"error": "bad request"},
                status=400,
            )

            with raises(ApiError):
                client.request("POST", path)

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_client_request_on_5xx(self):
        with override_regions(self.region_config):
            client = RegionSiloClient(self.region)
            path = "/api/0/imaginary-public-endpoint/"
            responses.add(
                responses.POST,
                f"{self.dummy_address}{path}",
                json={"error": "server exploded"},
                status=500,
            )

            with raises(ApiError):
                client.request("POST", path)

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
        assert err.args == ("allowed_region_ip_addresses is empty for: 172.31.255.255",)

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


def test_get_region_ip_addresses():
    internal_region_address = "http://i.am.an.internal.hostname:9000"
    region = Region("eu", 1, internal_region_address, RegionCategory.MULTI_TENANT)
    region_config = (region,)

    with override_regions(region_config), patch(
        "socket.gethostbyname"
    ) as mock_gethostbyname, patch("sentry_sdk.capture_exception") as mock_capture_exception:
        mock_gethostbyname.return_value = "172.31.255.255"
        assert get_region_ip_addresses() == frozenset([ipaddress.ip_address("172.31.255.255")])
        assert mock_capture_exception.call_count == 0

    with override_regions(region_config), patch(
        "socket.gethostbyname"
    ) as mock_gethostbyname, patch("urllib3.util.parse_url") as mock_parse_url, patch(
        "sentry_sdk.capture_exception"
    ) as mock_capture_exception:
        mock_parse_url.return_value = MagicMock(host=None)
        assert get_region_ip_addresses() == frozenset([])
        assert mock_gethostbyname.call_count == 0
        assert mock_capture_exception.call_count == 1
