from ipaddress import ip_address

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options


class TempestIpsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-tempest-ips"

    @override_options({"tempest.tempest-ips-api-response": ["10.0.0.1", "10.0.0.2"]})
    def test_simple(self):
        response = self.get_success_response()

        # Validate that we get back IP addresses
        for ip in response.content.decode().split("\n"):
            ip_address(ip)
