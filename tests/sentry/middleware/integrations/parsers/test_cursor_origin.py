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

    def _parser(
        self, event_type: str | None = None, installation_id: str | None = None
    ) -> CursorOriginRequestParser:
        # `headers=` with real header names rather than **HTTP_-prefixed environ:
        # splatting into post() makes mypy match the dict against data/
        # content_type/secure, and it reads closer to the actual delivery.
        headers: dict[str, str] = {}
        if event_type:
            headers["webhook-event-type"] = event_type
        if installation_id:
            headers["webhook-installation-id"] = installation_id
        request = self.factory.post(WEBHOOK_PATH, headers=headers)
        return CursorOriginRequestParser(request=request, response_handler=self.get_response)

    @responses.activate
    def test_installation_events_are_answered_in_control(self) -> None:
        # Disabling the Integration row on uninstall touches only control data,
        # so there is nothing to forward.
        response = self._parser(event_type="installation.deleted").get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @responses.activate
    def test_unknown_installation_is_acknowledged_rather_than_forwarded(self) -> None:
        # Erroring would make Origin retry forever and eventually disable the
        # endpoint over deliveries we could never handle.
        response = self._parser(
            event_type="repository.pushed", installation_id="i_01nonexistent"
        ).get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert_no_webhook_payloads()

    @responses.activate
    def test_push_without_an_installation_header_is_acknowledged(self) -> None:
        response = self._parser(event_type="repository.pushed").get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert_no_webhook_payloads()

    def test_resolves_the_integration_from_the_header(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            external_id="i_01example",
            name="sentry",
        )
        parser = self._parser(event_type="repository.pushed", installation_id="i_01example")

        assert parser.get_integration_from_request() == integration

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
