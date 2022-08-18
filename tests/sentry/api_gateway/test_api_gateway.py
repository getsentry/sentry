from django.test.client import RequestFactory

from sentry.api_gateway import proxy_request_if_needed
from sentry.testutils import TestCase


class ApiGatewayTest(TestCase):
    def setUp(self):
        self.control_url = "https://sentry.io/api/v1/users/johndoe"
        self.customer_url = "https://sentry.io/api/v1/organizations/members/sentry/johndoe"

    def test_simple(self):
        request = RequestFactory().get(self.control_url)
        assert proxy_request_if_needed(request) is None
