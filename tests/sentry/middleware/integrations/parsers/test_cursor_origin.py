import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.urls import reverse
from rest_framework import status

from sentry.integrations.middleware.hybrid_cloud.parser import SHED_INBOUND_KILLSWITCH
from sentry.middleware.integrations.parsers.cursor_origin import CursorOriginRequestParser
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
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

    @responses.activate
    @override_options({SHED_INBOUND_KILLSWITCH: [{"provider": "cursor_origin"}]})
    def test_the_break_glass_killswitch_sheds_a_flood(self) -> None:
        """Routing straight to control skips the check the forwarding path makes."""
        request = self.factory.post(reverse("sentry-integration-cursor-origin-webhook"), data={})
        parser = CursorOriginRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert response["Retry-After"]
        assert_no_webhook_payloads()
