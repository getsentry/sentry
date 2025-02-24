from ipaddress import ip_address

from sentry.testutils.cases import APITestCase


class UptimeIpsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-uptime-ips"

    def test_simple(self):
        response = self.get_success_response()

        # Validate that we get back IP addresses
        for ip in response.content.decode().split("\n"):
            ip_address(ip)
