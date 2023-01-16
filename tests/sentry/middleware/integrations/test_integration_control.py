from unittest.mock import MagicMock, patch

from django.test import RequestFactory, override_settings

from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.slack import SlackRequestParser
from sentry.silo import SiloMode
from sentry.testutils import TestCase


class IntegrationControlMiddlewareTest(TestCase):
    get_response = MagicMock()
    middleware = IntegrationControlMiddleware(get_response)
    prefix = IntegrationControlMiddleware.webhook_prefix

    def setUp(self):
        self.factory = RequestFactory()

    def validate_mock_ran_with_noop(self, request, mock):
        # Ensure mock runs when middleware is called
        mock.reset_mock()
        response = self.middleware(request)
        assert mock.called
        # Ensure noop response
        assert response == self.get_response()

    @override_settings(SILO_MODE=SiloMode.MONOLITH)
    @patch.object(
        IntegrationControlMiddleware,
        "_should_operate",
        wraps=middleware._should_operate,
    )
    def test_inactive_on_monolith(self, mock_should_operate):
        request = self.factory.post(f"{self.prefix}slack/webhook/")
        assert mock_should_operate(request) is False
        self.validate_mock_ran_with_noop(request, mock_should_operate)

    @override_settings(SILO_MODE=SiloMode.REGION)
    @patch.object(
        IntegrationControlMiddleware,
        "_should_operate",
        wraps=middleware._should_operate,
    )
    def test_inactive_on_region_silo(self, mock_should_operate):
        request = self.factory.post(f"{self.prefix}slack/webhook/")
        assert mock_should_operate(request) is False
        self.validate_mock_ran_with_noop(request, mock_should_operate)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationControlMiddleware,
        "_should_operate",
        wraps=middleware._should_operate,
    )
    def test_inactive_on_non_prefix(self, mock_should_operate):
        request = self.factory.get("/settings/")
        assert mock_should_operate(request) is False
        self.validate_mock_ran_with_noop(request, mock_should_operate)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationControlMiddleware,
        "_identify_provider",
        wraps=middleware._identify_provider,
    )
    def test_invalid_provider(self, mock_identify_provider):
        request = self.factory.post(f"{self.prefix}🔥🔥🔥/webhook/")
        assert mock_identify_provider(request) is None
        self.validate_mock_ran_with_noop(request, mock_identify_provider)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationControlMiddleware,
        "_identify_provider",
        wraps=middleware._identify_provider,
    )
    def test_empty_provider(self, mock_identify_provider):
        request = self.factory.post(f"{self.prefix}/webhook/")
        assert mock_identify_provider(request) is None
        self.validate_mock_ran_with_noop(request, mock_identify_provider)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationControlMiddleware,
        "_identify_provider",
        wraps=middleware._identify_provider,
    )
    def test_unknown_provider(self, mock_identify_provider):
        provider = "acme"
        request = self.factory.post(f"{self.prefix}{provider}/webhook/")
        assert mock_identify_provider(request) == provider
        assert IntegrationControlMiddleware.integration_parsers.get(provider) is None
        self.validate_mock_ran_with_noop(request, mock_identify_provider)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(SlackRequestParser, "get_response")
    def test_returns_parser_get_response(self, mock_parser_get_response):
        result = {"ok": True}
        mock_parser_get_response.return_value = result
        response = self.middleware(self.factory.post(f"{self.prefix}slack/webhook/"))
        assert result == response
