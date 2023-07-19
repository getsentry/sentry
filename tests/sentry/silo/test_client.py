import responses
from django.test import RequestFactory, override_settings
from pytest import raises

from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.silo import SiloMode
from sentry.silo.client import ControlSiloClient, RegionSiloClient, SiloClientError
from sentry.silo.util import PROXY_DIRECT_LOCATION_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils import TestCase
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
            ControlSiloClient()

        with raises(SiloClientError):
            RegionSiloClient(self.region)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_init_clients_from_control(self):
        with override_regions(self.region_config):
            with raises(SiloClientError):
                ControlSiloClient()

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

        client = ControlSiloClient()
        assert client.base_url is not None
        assert self.dummy_address in client.base_url

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
