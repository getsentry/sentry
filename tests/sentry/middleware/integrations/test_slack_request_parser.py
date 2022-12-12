from unittest.mock import MagicMock, patch

from django.test import RequestFactory, override_settings
from exam import fixture

from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.slack import SlackRequestParser
from sentry.models.integrations import Integration, OrganizationIntegration
from sentry.silo import SiloMode
from sentry.testutils import TestCase
from sentry.utils.signing import sign


class SlackRequestParserTest(TestCase):
    get_response = MagicMock()
    middleware = IntegrationControlMiddleware(get_response)
    factory = fixture(RequestFactory)
    provider = "slack"
    path_base = f"{IntegrationControlMiddleware.webhook_prefix}{provider}"

    def get_parser(self, path):
        self.request = self.factory.post(f"{self.path_base}{path}")
        return SlackRequestParser(self.request, self.get_response)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(SlackRequestParser, "get_response")
    def test_returns_parser_get_response(self, mock_parser_get_response):
        result = {"ok": True}
        mock_parser_get_response.return_value = result
        response = self.middleware(self.factory.post(f"{self.path_base}/webhook/"))
        assert result == response

    def test_installation(self):
        # TODO(Leander): Implement once parser is compatable with installation.
        pass

    @patch.object(SlackCommandRequest, "integration")
    @patch.object(SlackCommandRequest, "_validate_integration")
    @patch.object(SlackCommandRequest, "_authorize")
    def test_webhook(self, mock_authorize, mock_validate_integration, mock_integration):
        parser = self.get_parser("/commands/")
        integration = parser.get_integration()
        assert mock_authorize.called
        assert mock_validate_integration.called
        assert integration == mock_integration

    def test_django_view(self):
        # Create the signing data
        integration = Integration.objects.create(provider="slack")
        OrganizationIntegration.objects.create(
            organization_id=self.organization.id, integration_id=integration.id
        )
        params = {"organization_id": self.organization.id, "integration_id": integration.id}
        # Send the request
        parser = self.get_parser(f"/link-identity/{sign(**params)}/")
        parser_integration = parser.get_integration()
        assert parser_integration == integration
