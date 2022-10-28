from django.test import override_settings
from pytest import raises

from sentry.silo import SiloMode
from sentry.silo.client import ControlSiloClient, RegionSiloClient, SiloClientError
from sentry.testutils import TestCase
from sentry.types.region import Region, RegionCategory, RegionResolutionError


class SiloClientTest(TestCase):
    dummy_address = "sentry://server-address"
    region = Region("eu", 1, dummy_address, RegionCategory.MULTI_TENANT)
    region_config = (region,)

    @override_settings(SILO_MODE=SiloMode.MONOLITH)
    def test_init_clients_from_monolith(self):
        with raises(SiloClientError):
            ControlSiloClient()

        with raises(SiloClientError):
            RegionSiloClient(self.region.name)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_settings(SENTRY_REGION_CONFIG=region_config)
    def test_init_clients_from_control(self):
        with raises(SiloClientError):
            ControlSiloClient()

        with raises(RegionResolutionError):
            RegionSiloClient("atlantis")

        client = RegionSiloClient(self.region.name)
        assert self.region.address in client.base_url

    @override_settings(SILO_MODE=SiloMode.REGION)
    @override_settings(SENTRY_CONTROL_ADDRESS=dummy_address)
    def test_init_clients_from_region(self):
        with raises(SiloClientError):
            RegionSiloClient(self.region.name)

        client = ControlSiloClient()
        assert self.dummy_address in client.base_url
