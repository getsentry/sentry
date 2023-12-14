from unittest.mock import MagicMock, patch

from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from sentry.middleware.integrations.classifications import (
    IntegrationClassification,
    PluginClassification,
)
from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.plugin import PluginRequestParser
from sentry.middleware.integrations.parsers.slack import SlackRequestParser
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options


class BaseClassificationTestCase(TestCase):
    get_response = MagicMock()

    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    def validate_mock_ran_with_noop(self, request, mock):
        # Ensure mock runs when middleware is called
        mock.reset_mock()
        self.get_response.reset_mock()
        response = IntegrationControlMiddleware(get_response=self.get_response)(request)
        assert mock.called
        # Ensure noop response
        assert self.get_response.call_count == 1
        assert response == self.get_response()


class PluginClassifiationTest(BaseClassificationTestCase):
    get_response = MagicMock()
    plugin_cls = PluginClassification(response_handler=get_response)
    plugin_paths = [
        "/plugins/github/installations/webhook/",
        "/plugins/github/organizations/1/webhook/",
        "/plugins/bitbucket/organizations/1/webhook/",
    ]

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        PluginClassification,
        "should_operate",
        wraps=plugin_cls.should_operate,
    )
    def test_should_operate_uses_parser(self, mock_should_operate):
        for plugin_path in self.plugin_paths:
            request = self.factory.get(plugin_path)
            prp = PluginRequestParser(request=request, response_handler=self.get_response)
            assert mock_should_operate(request) == prp.should_operate()

    @patch("sentry.middleware.integrations.parsers.plugin.PluginRequestParser.get_response")
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_uses_parser(self, mock_rp_get_response):
        for plugin_path in self.plugin_paths:
            assert not mock_rp_get_response.called
            request = self.factory.get(plugin_path)
            self.plugin_cls.get_response(request)
            assert mock_rp_get_response.called
            mock_rp_get_response.reset_mock()

    @override_settings(SILO_MODE=SiloMode.MONOLITH)
    def test_passthrough_monolith_mode(self):
        for plugin_path in self.plugin_paths:
            self.get_response.reset_mock()
            expected_response = HttpResponse(status=204)
            self.get_response.return_value = expected_response

            plugin_cls = PluginClassification(response_handler=self.get_response)
            request = self.factory.get(plugin_path)

            assert plugin_cls.should_operate(request) is False
            # Response was routed to the control silo
            assert plugin_cls.get_response(request) == expected_response
            assert self.get_response.call_count == 1
            assert self.get_response.called_with(request)

    @override_settings(SILO_MODE=SiloMode.MONOLITH)
    def test_enable_in_monolith_mode(self):
        cases = [
            ("/plugins/github/installations/webhook/", False),
            ("/plugins/github/organizations/1/webhook/", True),
            ("/plugins/bitbucket/organizations/1/webhook/", True),
        ]
        for plugin_path, expected_should_operate in cases:
            self.get_response.reset_mock()
            expected_response = HttpResponse(status=204)
            self.get_response.return_value = expected_response

            with override_options({"hybrid_cloud.integrations.monolith.enable-plugins": True}):
                plugin_cls = PluginClassification(response_handler=self.get_response)
                request = self.factory.get(plugin_path)

                assert plugin_cls.should_operate(request) is expected_should_operate
                # Response was routed to the control silo
                assert plugin_cls.get_response(request) == expected_response
                assert self.get_response.call_count == 1
                assert self.get_response.called_with(request)


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
    def test_inactive_on_non_prefix(self, mock_should_operate):
        request = self.factory.get("/settings/")
        assert mock_should_operate(request) is False
        self.validate_mock_ran_with_noop(request, mock_should_operate)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationClassification,
        "_identify_provider",
        wraps=integration_cls._identify_provider,
    )
    def test_invalid_provider(self, mock_identify_provider):
        request = self.factory.post(f"{self.prefix}🔥🔥🔥/webhook/")
        assert mock_identify_provider(request) == "🔥🔥🔥"
        self.validate_mock_ran_with_noop(request, mock_identify_provider)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationClassification,
        "_identify_provider",
        wraps=integration_cls._identify_provider,
    )
    def test_empty_provider(self, mock_identify_provider):
        request = self.factory.post(f"{self.prefix}/webhook/")
        assert mock_identify_provider(request) is None
        self.validate_mock_ran_with_noop(request, mock_identify_provider)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(
        IntegrationClassification,
        "_identify_provider",
        wraps=integration_cls._identify_provider,
    )
    def test_unknown_provider(self, mock_identify_provider):
        provider = "acme"
        request = self.factory.post(f"{self.prefix}{provider}/webhook/")
        assert mock_identify_provider(request) == provider
        assert self.integration_cls.integration_parsers.get(provider) is None
        self.validate_mock_ran_with_noop(request, mock_identify_provider)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(SlackRequestParser, "get_response")
    def test_returns_parser_get_response(self, mock_parser_get_response):
        result = HttpResponse(status=204)
        mock_parser_get_response.return_value = result
        response = self.integration_cls.get_response(
            self.factory.post(f"{self.prefix}{SlackRequestParser.provider}/webhook/")
        )
        assert result == response

    @override_settings(SILO_MODE=SiloMode.MONOLITH)
    def test_passthrough_monolith_mode(self):
        self.get_response.reset_mock()
        expected_response = HttpResponse(status=204)
        self.get_response.return_value = expected_response

        with override_options({"hybrid_cloud.integrations.monolith.allow-list": ["discord"]}):
            integration_cls = IntegrationClassification(response_handler=self.get_response)
            request = self.factory.post(f"{self.prefix}{SlackRequestParser.provider}/webhook/")

            assert integration_cls.should_operate(request) is False
            assert integration_cls.get_response(request) == expected_response
            assert self.get_response.call_count == 1
            assert self.get_response.called_with(request)

    @override_settings(SILO_MODE=SiloMode.MONOLITH)
    def test_enable_in_monolith_mode(self):
        self.get_response.reset_mock()
        expected_response = HttpResponse(status=204)
        self.get_response.return_value = expected_response

        with override_options({"hybrid_cloud.integrations.monolith.allow-list": ["slack"]}):
            integration_cls = IntegrationClassification(response_handler=self.get_response)
            request = self.factory.post(f"{self.prefix}{SlackRequestParser.provider}/webhook/")

            assert integration_cls.should_operate(request) is True
            # Response was routed to the control silo
            assert integration_cls.get_response(request) == expected_response
            assert self.get_response.call_count == 1
            assert self.get_response.called_with(request)
