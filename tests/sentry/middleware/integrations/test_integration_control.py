from unittest.mock import MagicMock, patch

from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from sentry.middleware.integrations.classifications import (
    BaseClassification,
    IntegrationClassification,
    PluginClassification,
)
from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.jira import JiraRequestParser
from sentry.middleware.integrations.parsers.jira_server import JiraServerRequestParser
from sentry.middleware.integrations.parsers.plugin import PluginRequestParser
from sentry.middleware.integrations.parsers.slack import SlackRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase


@patch.object(
    IntegrationControlMiddleware,
    "classifications",
    [IntegrationClassification, PluginClassification],
)
class IntegrationControlMiddlewareTest(TestCase):
    get_response = MagicMock()
    middleware = IntegrationControlMiddleware(get_response=get_response)
    integration_cls = IntegrationClassification(response_handler=get_response)
    plugin_cls = PluginClassification(response_handler=get_response)

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
        request = self.factory.post("/extensions/slack/webhook/")
        assert mock_should_operate(request) is False
        self.validate_mock_ran_with_noop(request, mock_should_operate)

    @override_settings(SILO_MODE=SiloMode.REGION)
    @patch.object(
        IntegrationControlMiddleware,
        "_should_operate",
        wraps=middleware._should_operate,
    )
    def test_inactive_on_region_silo(self, mock_should_operate):
        request = self.factory.post("/extensions/slack/webhook/")
        assert mock_should_operate(request) is False
        self.validate_mock_ran_with_noop(request, mock_should_operate)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(IntegrationClassification, "should_operate", wraps=integration_cls.should_operate)
    @patch.object(PluginClassification, "should_operate", wraps=plugin_cls.should_operate)
    def test_attempts_all_classifications(self, mock_plugin_operate, mock_integration_operate):
        class NewClassification(BaseClassification):
            pass

        self.middleware.register_classifications(classifications=[NewClassification])

        with (
            patch.object(
                NewClassification, "should_operate", return_value=True
            ) as mock_new_should_operate,
            patch.object(NewClassification, "get_response") as mock_new_get_response,
        ):
            self.middleware(self.factory.post("/"))
            assert mock_integration_operate.called
            assert mock_plugin_operate.called
            assert mock_new_should_operate.called
            assert mock_new_get_response.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(IntegrationClassification, "should_operate", wraps=integration_cls.should_operate)
    @patch.object(PluginClassification, "should_operate", wraps=plugin_cls.should_operate)
    def test_attempts_ordered_classifications(self, mock_plugin_operate, mock_integration_operate):
        self.middleware(self.factory.post("/extensions/slack/webhook/"))
        assert mock_integration_operate.called
        assert not mock_plugin_operate.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(SlackRequestParser, "get_response")
    def test_returns_parser_get_response_integration(self, mock_parser_get_response):
        result = HttpResponse(status=204)
        mock_parser_get_response.return_value = result
        response = self.middleware(self.factory.post("/extensions/slack/webhook/"))
        assert result == response

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(JiraServerRequestParser, "get_response")
    def test_returns_parser_get_response_jiraserver(self, mock_parser_get_response):
        result = HttpResponse(status=204)
        mock_parser_get_response.return_value = result
        response = self.middleware(
            self.factory.post("/extensions/jira_server/issue-updated/abc-123/")
        )
        assert result == response

        # jira-server is the inflection used in URLS and should match
        response = self.middleware(
            self.factory.post("/extensions/jira-server/issue-updated/abc-123/")
        )
        assert result == response

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(JiraRequestParser, "get_response")
    def test_returns_parser_get_response_jira(self, mock_parser_get_response):
        result = HttpResponse(status=204)
        mock_parser_get_response.return_value = result
        response = self.middleware(self.factory.post("/extensions/jira/issue-updated/abc-123/"))
        assert result == response

        # provider pattern should capture - and forward to jira server.
        response = self.middleware(
            self.factory.post("/extensions/jira-server/issue-updated/abc-123/")
        )
        assert result != response

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_handles_missing_integration(self):
        response = self.middleware(self.factory.post("/extensions/jira/issue-updated/"))
        assert response.status_code == 404

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(PluginRequestParser, "get_response")
    def test_returns_parser_get_response_plugin(self, mock_parser_get_response):
        result = HttpResponse(status=204)
        mock_parser_get_response.return_value = result
        response = self.middleware(self.factory.post("/plugins/bitbucket/organizations/1/webhook/"))
        assert result == response
