import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.urls import reverse

from sentry.middleware.integrations.parsers.cursor_origin import CursorOriginRequestParser
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_no_webhook_payloads
from sentry.testutils.silo import control_silo_test


@control_silo_test
class CursorOriginRequestParserTest(TestCase):
    factory = RequestFactory()

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    @responses.activate
    def test_routing_to_control(self) -> None:
        """Origin only delivers installation events, which control silo owns."""
        request = self.factory.post(reverse("sentry-integration-cursor-origin-webhook"), data={})
        parser = CursorOriginRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()
