from unittest.mock import MagicMock, patch

from django.test import RequestFactory, override_settings
from exam import fixture

from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.silo import SiloMode
from sentry.testutils import TestCase


class IntegrationControlMiddlewareTest(TestCase):
    get_response = MagicMock()
    middleware = IntegrationControlMiddleware(get_response)
    factory = fixture(RequestFactory)

    path = f"{IntegrationControlMiddleware.webhook_prefix}acme/webhook/"

    @override_settings(SILO_MODE=SiloMode.MONOLITH)
    @patch.object(
        IntegrationControlMiddleware,
        "_should_operate",
        wraps=middleware._should_operate,
    )
    def test_inactive_on_monolith(self, mock_should_operate):
        request = self.factory.get(self.path)

        # Ensure the MONOLITH prevents operation
        assert mock_should_operate(request) is False

        # Ensure method runs when middleware is called
        mock_should_operate.reset_mock()
        response = self.middleware(request)
        assert mock_should_operate.called

        # Ensure noop response
        assert response == self.get_response()

    @override_settings(SILO_MODE=SiloMode.REGION)
    @patch.object(
        IntegrationControlMiddleware,
        "_should_operate",
        wraps=middleware._should_operate,
    )
    def test_inactive_on_region_silo(self, mock_should_operate):
        request = self.factory.get(self.path)

        # Ensure the REGION prevents operation
        assert mock_should_operate(request) is False

        # Ensure method runs when middleware is called
        mock_should_operate.reset_mock()
        response = self.middleware(request)
        assert mock_should_operate.called

        # Ensure noop response
        assert response == self.get_response()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_malformed_provider_path(self):
        # path = f"{IntegrationControlMiddleware.webhook_prefix}🔥🔥🔥/webhook/"
        # request = self.factory.get(path)
        # response = self.middleware(request)
        # Catch Regex error here
        pass

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_empty_provider_path(self):
        pass

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_no_prefix_path(self):
        pass

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_no_provider_parser(self):
        pass
