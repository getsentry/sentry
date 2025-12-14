from ipaddress import ip_address

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UptimeIpsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-uptime-ips"

    @override_options({"uptime.uptime-ips-api-response": ["10.0.0.1", "10.0.0.2"]})
    def test_simple(self) -> None:
        response = self.get_success_response()

        # Validate that we get back IP addresses
        for ip in response.content.decode().split("\n"):
            ip_address(ip)
