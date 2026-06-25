from unittest import TestCase
from unittest.mock import MagicMock, patch

from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from sentry.middleware.integrations.classifications import (
    IntegrationClassification,
)
from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.slack import SlackRequestParser
from sentry.silo.base import SiloMode


class BaseClassificationTestCase(TestCase):
    get_response = MagicMock()

    def setUp(self) -> None:
        super().setUp()
        self.factory = RequestFactory()

    def validate_mock_ran_with_noop(self, request, mock):
        # Ensure mock runs when middleware is called
        mock.reset_mock()
        response = IntegrationControlMiddleware(get_response=self.get_response)(request)
        assert mock.called
        # Ensure noop response
        assert response == self.get_response()


class IntegrationClassificationTest(BaseClassificationTestCase):
    get_response = MagicMock()
    integration_cls = IntegrationClassification(response_handler=get_response)
    prefix = IntegrationClassification.integration_prefix

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationClassification,
        "should_operate",
        wraps=integration_cls.should_operate,
    )
    def test_inactive_on_non_prefix(self, mock_should_operate) -> None:
        request = self.factory.get("/settings/")
        assert mock_should_operate(request) is False
        self.validate_mock_ran_with_noop(request, mock_should_operate)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationClassification,
        "_identify_provider",
        wraps=integration_cls._identify_provider,
    )
    def test_invalid_provider(self, mock_identify_provider) -> None:
        request = self.factory.post(f"{self.prefix}🔥🔥🔥/webhook/")
        assert mock_identify_provider(request) == "🔥🔥🔥"
        self.validate_mock_ran_with_noop(request, mock_identify_provider)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationClassification,
        "_identify_provider",
        wraps=integration_cls._identify_provider,
    )
    def test_empty_provider(self, mock_identify_provider) -> None:
        request = self.factory.post(f"{self.prefix}/webhook/")
        assert mock_identify_provider(request) is None
        self.validate_mock_ran_with_noop(request, mock_identify_provider)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationClassification,
        "_identify_provider",
        wraps=integration_cls._identify_provider,
    )
    def test_unknown_provider(self, mock_identify_provider) -> None:
        provider = "acme"
        request = self.factory.post(f"{self.prefix}{provider}/webhook/")
        assert mock_identify_provider(request) == provider
        assert self.integration_cls.integration_parsers.get(provider) is None
        self.validate_mock_ran_with_noop(request, mock_identify_provider)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(SlackRequestParser, "get_response")
    def test_returns_parser_get_response(self, mock_parser_get_response) -> None:
        result = HttpResponse(status=204)
        mock_parser_get_response.return_value = result
        response = self.integration_cls.get_response(
            self.factory.post(f"{self.prefix}{SlackRequestParser.provider}/webhook/")
        )
        assert result == response
