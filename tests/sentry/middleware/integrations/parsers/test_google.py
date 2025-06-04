import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory

from sentry.middleware.integrations.parsers.google import GoogleRequestParser
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_no_webhook_payloads
from sentry.testutils.silo import control_silo_test


@control_silo_test
class GoogleRequestParserTest(TestCase):
    factory = RequestFactory()
    google_dummy_requests = [
        factory.get("/extensions/google/setup/"),
        # Unsure how these requests are getting generated, but they shouldn't fail in the middleware
        factory.get("/extensions/google/setup/null/"),
        factory.get("/extensions/google/setup/null/api/0/organizations/"),
    ]

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    @responses.activate
    def test_routing_all_to_control(self):
        for request in self.google_dummy_requests:
            parser = GoogleRequestParser(request=request, response_handler=self.get_response)
            assert parser.get_integration_from_request() is None
            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == 200
            assert response.content == b"passthrough"
            assert len(responses.calls) == 0
            assert_no_webhook_payloads()
