from dataclasses import dataclass
from unittest.mock import ANY, patch

from sentry.constants import SentryAppStatus
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.notification_action.action_handler_registry.base import (
    IntegrationActionHandler,
)
from sentry.plugins.base.manager import PluginManager
from sentry.plugins.sentry_webhooks.plugin import WebHooksPlugin
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.types import ActionHandler
from sentry_plugins.pagerduty.plugin import PagerDutyPlugin
from sentry_plugins.slack.plugin import SlackPlugin
from sentry_plugins.trello.plugin import TrelloPlugin


@region_silo_test
class OrganizationAvailableActionAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-available-action-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.registry = Registry[ActionHandler](enable_reverse_lookup=False)
        self.registry_patcher = patch(
            "sentry.workflow_engine.endpoints.organization_available_action_index.action_handler_registry",
            new=self.registry,
        )
        self.registry_patcher.start()

        self.plugin_registry = PluginManager()
        self.plugins_registry_patcher = patch(
            "sentry.workflow_engine.processors.action.plugins",
            new=self.plugin_registry,
        )
        self.plugins_registry_patcher.start()

    def tearDown(self) -> None:
        super().tearDown()
        self.registry_patcher.stop()
        self.plugins_registry_patcher.stop()

    def setup_email(self):
        @self.registry.register(Action.Type.EMAIL)
        @dataclass(frozen=True)
        class EmailActionHandler(ActionHandler):
            group = ActionHandler.Group.NOTIFICATION
            config_schema = {}
            data_schema = {}

    def setup_integrations(self):
        @self.registry.register(Action.Type.SLACK)
        @dataclass(frozen=True)
        class SlackActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.NOTIFICATION
            provider_slug = IntegrationProviderSlug.SLACK
            config_schema = {}
            data_schema = {}

        token = "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.slack_integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            name="My Slack Integration",
            provider="slack",
            metadata={"access_token": token, "installation_type": "born_as_bot"},
        )

        @self.registry.register(Action.Type.GITHUB)
        @dataclass(frozen=True)
        class GithubActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.TICKET_CREATION
            provider_slug = IntegrationProviderSlug.GITHUB
            config_schema = {}
            data_schema = {}

        token = "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.github_integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            name="My GitHub Integration",
            provider="github",
            metadata={"access_token": token, "installation_type": "born_as_bot"},
        )

        # should not return integrations that are not installed
        @self.registry.register(Action.Type.MSTEAMS)
        @dataclass(frozen=True)
        class MSTeamsActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.NOTIFICATION
            provider_slug = IntegrationProviderSlug.MSTEAMS
            config_schema = {}
            data_schema = {}

    def setup_sentry_apps(self):
        @self.registry.register(Action.Type.SENTRY_APP)
        @dataclass(frozen=True)
        class SentryAppActionHandler(ActionHandler):
            group = ActionHandler.Group.OTHER
            config_schema = {}
            data_schema = {}

        self.no_component_sentry_app = self.create_sentry_app(
            name="Poppy's Fire Sentry App",
            organization=self.organization,
            is_alertable=True,
        )
        self.no_component_sentry_app_installation = self.create_sentry_app_installation(
            slug=self.no_component_sentry_app.slug, organization=self.organization
        )

        self.sentry_app = self.create_sentry_app(
            name="Moo Deng's Fire Sentry App",
            organization=self.organization,
            schema={
                "elements": [
                    self.create_alert_rule_action_schema(),
                ]
            },
            is_alertable=True,
        )
        self.sentry_app_installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization
        )

        # should not return sentry apps that are not installed
        self.create_sentry_app(
            name="Bad Sentry App",
            organization=self.organization,
            is_alertable=True,
        )

    def setup_webhooks(self):
        @self.registry.register(Action.Type.WEBHOOK)
        @dataclass(frozen=True)
        class WebhookActionHandler(ActionHandler):
            group = ActionHandler.Group.OTHER
            config_schema = {}
            data_schema = {}

        self.plugin_registry.register(WebHooksPlugin)
        self.webhooks_plugin = self.plugin_registry.get(WebHooksPlugin.slug)
        self.webhooks_plugin.enable(self.project)

        self.plugin_registry.register(SlackPlugin)
        self.slack_plugin = self.plugin_registry.get(SlackPlugin.slug)
        self.slack_plugin.enable(self.project)
        # each plugin should only be returned once, even if it's enabled for multiple projects
        self.slack_plugin.enable(self.create_project())

        # non notification plugins should not be returned
        self.plugin_registry.register(TrelloPlugin)
        self.trello_plugin = self.plugin_registry.get(TrelloPlugin.slug)
        self.trello_plugin.enable(self.project)

        # plugins that are not enabled should not be returned
        self.plugin_registry.register(PagerDutyPlugin)

    def test_simple(self):
        self.setup_email()

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )
        assert len(response.data) == 1
        assert response.data == [
            {
                "type": Action.Type.EMAIL,
                "handlerGroup": ActionHandler.Group.NOTIFICATION.value,
                "configSchema": {},
                "dataSchema": {},
            }
        ]

    def test_integrations(self):
        self.setup_integrations()

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )
        assert len(response.data) == 2
        assert response.data == [
            # notification actions first
            {
                "type": Action.Type.SLACK,
                "handlerGroup": ActionHandler.Group.NOTIFICATION.value,
                "configSchema": {},
                "dataSchema": {},
                "integrations": [
                    {"id": str(self.slack_integration.id), "name": self.slack_integration.name}
                ],
            },
            # then ticket creation actions
            {
                "type": Action.Type.GITHUB,
                "handlerGroup": ActionHandler.Group.TICKET_CREATION.value,
                "configSchema": {},
                "dataSchema": {},
                "integrations": [
                    {"id": str(self.github_integration.id), "name": self.github_integration.name}
                ],
            },
        ]

    def test_sentry_apps(self):
        self.setup_sentry_apps()

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )
        assert len(response.data) == 2
        assert response.data == [
            {
                "type": Action.Type.SENTRY_APP,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": {},
                "dataSchema": {},
                "sentryApp": {
                    "id": str(self.sentry_app.id),
                    "name": self.sentry_app.name,
                    "installationId": str(self.sentry_app_installation.id),
                    "status": SentryAppStatus.as_str(self.sentry_app.status),
                    "settings": ANY,
                },
            },
            {
                "type": Action.Type.SENTRY_APP,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": {},
                "dataSchema": {},
                "sentryApp": {
                    "id": str(self.no_component_sentry_app.id),
                    "name": self.no_component_sentry_app.name,
                    "installationId": str(self.no_component_sentry_app_installation.id),
                    "status": SentryAppStatus.as_str(self.no_component_sentry_app.status),
                },
            },
        ]

    def test_webhooks(self):
        self.setup_webhooks()

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )
        assert len(response.data) == 1
        assert response.data == [
            {
                "type": Action.Type.WEBHOOK,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": {},
                "dataSchema": {},
                "services": [
                    {"slug": "slack", "name": "(Legacy) Slack"},
                    {"slug": "webhooks", "name": "WebHooks"},
                ],
            }
        ]

    def test_actions_sorting(self):

        self.setup_sentry_apps()
        self.setup_integrations()
        self.setup_webhooks()
        self.setup_email()

        @self.registry.register(Action.Type.PLUGIN)
        @dataclass(frozen=True)
        class PluginActionHandler(ActionHandler):
            group = ActionHandler.Group.OTHER

            config_schema = {}
            data_schema = {}

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )
        assert len(response.data) == 7
        assert response.data == [
            # notification actions, sorted alphabetically with email first
            {
                "type": Action.Type.EMAIL,
                "handlerGroup": ActionHandler.Group.NOTIFICATION.value,
                "configSchema": {},
                "dataSchema": {},
            },
            {
                "type": Action.Type.SLACK,
                "handlerGroup": ActionHandler.Group.NOTIFICATION.value,
                "configSchema": {},
                "dataSchema": {},
                "integrations": [
                    {"id": str(self.slack_integration.id), "name": self.slack_integration.name}
                ],
            },
            # other actions, non sentry app actions first then sentry apps sorted alphabetically by name
            {
                "type": Action.Type.PLUGIN,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": {},
                "dataSchema": {},
            },
            {
                "type": Action.Type.WEBHOOK,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": {},
                "dataSchema": {},
                "services": [
                    {"slug": "slack", "name": "(Legacy) Slack"},
                    {"slug": "webhooks", "name": "WebHooks"},
                ],
            },
            {
                "type": Action.Type.SENTRY_APP,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": {},
                "dataSchema": {},
                "sentryApp": {
                    "id": str(self.sentry_app.id),
                    "name": self.sentry_app.name,
                    "installationId": str(self.sentry_app_installation.id),
                    "status": SentryAppStatus.as_str(self.sentry_app.status),
                    "settings": ANY,
                },
            },
            {
                "type": Action.Type.SENTRY_APP,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": {},
                "dataSchema": {},
                "sentryApp": {
                    "id": str(self.no_component_sentry_app.id),
                    "name": self.no_component_sentry_app.name,
                    "installationId": str(self.no_component_sentry_app_installation.id),
                    "status": SentryAppStatus.as_str(self.no_component_sentry_app.status),
                },
            },
            # ticket creation actions, sorted alphabetically
            {
                "type": Action.Type.GITHUB,
                "handlerGroup": ActionHandler.Group.TICKET_CREATION.value,
                "configSchema": {},
                "dataSchema": {},
                "integrations": [
                    {"id": str(self.github_integration.id), "name": self.github_integration.name}
                ],
            },
        ]
