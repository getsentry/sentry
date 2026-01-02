from dataclasses import dataclass
from unittest.mock import MagicMock, patch

from sentry.constants import SentryAppStatus
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pagerduty.utils import add_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.notification_action.action_handler_registry.base import (
    IntegrationActionHandler,
)
from sentry.plugins.base.manager import PluginManager
from sentry.plugins.sentry_webhooks.plugin import WebHooksPlugin
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.types import ActionHandler
from sentry_plugins.pagerduty.plugin import PagerDutyPlugin
from sentry_plugins.slack.plugin import SlackPlugin
from sentry_plugins.trello.plugin import TrelloPlugin


@region_silo_test
class OrganizationAvailableActionAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-available-action-index"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        self.registry = Registry[type[ActionHandler]](enable_reverse_lookup=False)
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

    def setup_email(self) -> None:
        @self.registry.register(Action.Type.EMAIL)
        @dataclass(frozen=True)
        class EmailActionHandler(ActionHandler):
            group = ActionHandler.Group.NOTIFICATION
            config_schema = {}
            data_schema = {}

    def setup_integrations(self) -> None:
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

    def setup_integrations_with_services(self) -> None:
        @self.registry.register(Action.Type.PAGERDUTY)
        @dataclass(frozen=True)
        class PagerdutyActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.TICKET_CREATION
            provider_slug = IntegrationProviderSlug.PAGERDUTY
            config_schema = {}
            data_schema = {}

        services = [
            {
                "type": "service",
                "integration_key": "PND4F9",
                "service_id": "123",
                "service_name": "moo-deng",
            },
            {
                "type": "service",
                "integration_key": "PND4F98",
                "service_id": "234",
                "service_name": "moo-waan",
            },
        ]
        self.pagerduty_integration, org_integration = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
            metadata={"services": services},
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.pagerduty_service_1 = add_service(
                org_integration,
                service_name=services[0]["service_name"],
                integration_key=services[0]["integration_key"],
            )
            self.pagerduty_service_2 = add_service(
                org_integration,
                service_name=services[1]["service_name"],
                integration_key=services[1]["integration_key"],
            )

        @self.registry.register(Action.Type.OPSGENIE)
        @dataclass(frozen=True)
        class OpsgenieActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.TICKET_CREATION
            provider_slug = IntegrationProviderSlug.OPSGENIE
            config_schema = {}
            data_schema = {}

        metadata = {
            "api_key": "1234-ABCD",
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "test-app.app.opsgenie.com",
        }
        self.og_team = {"id": "123-id", "team": "cool-team", "integration_key": "1234-5678"}
        self.opsgenie_integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="opsgenie",
            name="test-app",
            external_id="test-app",
            metadata=metadata,
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.opsgenie_integration.add_organization(self.organization, self.user)
            self.org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=self.opsgenie_integration.id
            )
            self.org_integration.config = {"team_table": [self.og_team]}
            self.org_integration.save()

    def setup_sentry_apps(self) -> None:
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

        self.sentry_app_settings_schema = self.create_alert_rule_action_schema()
        self.sentry_app = self.create_sentry_app(
            name="Moo Deng's Fire Sentry App",
            organization=self.organization,
            schema={
                "elements": [
                    self.sentry_app_settings_schema,
                ]
            },
            is_alertable=True,
        )
        self.sentry_app_installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization
        )

        # should not return sentry apps that are not alertable
        self.not_alertable_sentry_app = self.create_sentry_app(
            name="Not Alertable Sentry App",
            organization=self.organization,
            is_alertable=False,
        )
        self.not_alertable_sentry_app_installation = self.create_sentry_app_installation(
            slug=self.not_alertable_sentry_app.slug, organization=self.organization
        )

        self.not_alertable_sentry_app = self.create_sentry_app(
            name="Not Alertable Sentry App With Component",
            organization=self.organization,
            schema={
                "elements": [
                    self.sentry_app_settings_schema,
                ]
            },
            is_alertable=False,
        )
        self.not_alertable_sentry_app_with_component_installation = (
            self.create_sentry_app_installation(
                slug=self.not_alertable_sentry_app.slug, organization=self.organization
            )
        )

        # should not return sentry apps that are not installed
        self.create_sentry_app(
            name="Bad Sentry App",
            organization=self.organization,
            is_alertable=True,
        )

    def setup_webhooks(self) -> None:
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

    def test_simple(self) -> None:
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

    def test_simple_integrations(self) -> None:
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

    @with_feature({"organizations:integrations-ticket-rules": False})
    def test_does_not_return_ticket_actions_without_feature(self) -> None:
        self.setup_integrations()

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )
        assert len(response.data) == 1
        assert response.data == [
            # only notification actions are returned
            {
                "type": Action.Type.SLACK,
                "handlerGroup": ActionHandler.Group.NOTIFICATION.value,
                "configSchema": {},
                "dataSchema": {},
                "integrations": [
                    {"id": str(self.slack_integration.id), "name": self.slack_integration.name}
                ],
            }
        ]

    def test_integrations_with_services(self) -> None:
        self.setup_integrations_with_services()
        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )
        assert len(response.data) == 2
        assert response.data == [
            {
                "type": Action.Type.OPSGENIE,
                "handlerGroup": ActionHandler.Group.TICKET_CREATION.value,
                "configSchema": {},
                "dataSchema": {},
                "integrations": [
                    {
                        "id": str(self.opsgenie_integration.id),
                        "name": self.opsgenie_integration.name,
                        "services": [
                            {
                                "id": str(self.og_team["id"]),
                                "name": self.og_team["team"],
                            },
                        ],
                    }
                ],
            },
            {
                "type": Action.Type.PAGERDUTY,
                "handlerGroup": ActionHandler.Group.TICKET_CREATION.value,
                "configSchema": {},
                "dataSchema": {},
                "integrations": [
                    {
                        "id": str(self.pagerduty_integration.id),
                        "name": self.pagerduty_integration.name,
                        "services": [
                            {
                                "id": str(self.pagerduty_service_1["id"]),
                                "name": self.pagerduty_service_1["service_name"],
                            },
                            {
                                "id": str(self.pagerduty_service_2["id"]),
                                "name": self.pagerduty_service_2["service_name"],
                            },
                        ],
                    },
                ],
            },
        ]

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_sentry_apps(self, mock_sentry_app_component_preparer: MagicMock) -> None:
        self.setup_sentry_apps()

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )

        # should only return the sentry app with a component
        assert len(response.data) == 1
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
                    "installationUuid": str(self.sentry_app_installation.uuid),
                    "status": SentryAppStatus.as_str(self.sentry_app.status),
                    "settings": self.sentry_app_settings_schema["settings"],
                    "title": self.sentry_app_settings_schema["title"],
                },
            },
        ]

    @patch(
        "sentry.workflow_engine.endpoints.organization_available_action_index.prepare_ui_component"
    )
    def test_sentry_apps_filters_failed_component_preparation(
        self, mock_prepare_ui_component: MagicMock
    ) -> None:
        """Test that sentry apps whose components fail to prepare are filtered out"""
        self.setup_sentry_apps()

        # make prepare_ui_component return None to simulate a broken app
        mock_prepare_ui_component.return_value = None

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )

        # verify prepare_ui_component was called
        assert mock_prepare_ui_component.called
        # should return no sentry apps since component preparation failed
        assert len(response.data) == 0

    def test_webhooks(self) -> None:
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

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_actions_sorting(self, mock_sentry_app_component_preparer: MagicMock) -> None:

        self.setup_sentry_apps()
        self.setup_integrations()
        self.setup_integrations_with_services()
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
        assert len(response.data) == 8
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
            # webhook action should include sentry apps without components
            {
                "type": Action.Type.WEBHOOK,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": {},
                "dataSchema": {},
                "services": [
                    {"slug": "slack", "name": "(Legacy) Slack"},
                    {
                        "slug": self.no_component_sentry_app.slug,
                        "name": self.no_component_sentry_app.name,
                    },
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
                    "installationUuid": str(self.sentry_app_installation.uuid),
                    "status": SentryAppStatus.as_str(self.sentry_app.status),
                    "settings": self.sentry_app_settings_schema["settings"],
                    "title": self.sentry_app_settings_schema["title"],
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
            {
                "type": Action.Type.OPSGENIE,
                "handlerGroup": ActionHandler.Group.TICKET_CREATION.value,
                "configSchema": {},
                "dataSchema": {},
                "integrations": [
                    {
                        "id": str(self.opsgenie_integration.id),
                        "name": self.opsgenie_integration.name,
                        "services": [
                            {
                                "id": str(self.og_team["id"]),
                                "name": self.og_team["team"],
                            },
                        ],
                    }
                ],
            },
            {
                "type": Action.Type.PAGERDUTY,
                "handlerGroup": ActionHandler.Group.TICKET_CREATION.value,
                "configSchema": {},
                "dataSchema": {},
                "integrations": [
                    {
                        "id": str(self.pagerduty_integration.id),
                        "name": self.pagerduty_integration.name,
                        "services": [
                            {
                                "id": str(self.pagerduty_service_1["id"]),
                                "name": self.pagerduty_service_1["service_name"],
                            },
                            {
                                "id": str(self.pagerduty_service_2["id"]),
                                "name": self.pagerduty_service_2["service_name"],
                            },
                        ],
                    }
                ],
            },
        ]
