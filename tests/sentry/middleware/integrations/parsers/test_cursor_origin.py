import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory

from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.cursor_origin import CursorOriginRequestParser
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_no_webhook_payloads
from sentry.testutils.silo import control_silo_test

WEBHOOK_PATH = "/extensions/cursor-origin/webhook/"


@control_silo_test
class CursorOriginRequestParserTest(TestCase):
    factory = RequestFactory()

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    @responses.activate
    def test_routing_all_to_control(self) -> None:
        request = self.factory.post(WEBHOOK_PATH)
        parser = CursorOriginRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    def test_registered_for_the_hyphenated_url(self) -> None:
        """The URL says ``cursor-origin`` and the provider slug says
        ``cursor_origin``; the classification normalizes between them. Without a
        parser registered under the normalized name it reports every delivery as
        an unknown provider, so assert the lookup actually lands here.
        """
        classification = IntegrationClassification(response_handler=self.get_response)
        request = self.factory.post(WEBHOOK_PATH)

        provider = classification._identify_provider(request)

        assert provider == "cursor_origin"
        assert classification.integration_parsers[provider] is CursorOriginRequestParser
