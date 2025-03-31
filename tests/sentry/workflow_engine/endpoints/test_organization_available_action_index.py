from dataclasses import dataclass
from unittest.mock import ANY, patch

from sentry.constants import SentryAppStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.registry import Registry
from sentry.workflow_engine.handlers.action.notification.base import IntegrationActionHandler
from sentry.workflow_engine.handlers.action.notification.common import (
    GENERIC_ACTION_CONFIG_SCHEMA,
    MESSAGING_ACTION_CONFIG_SCHEMA,
    NOTES_SCHEMA,
    TAGS_SCHEMA,
)
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.types import ActionHandler

MOCK_DATA_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "description": "Mock schema for action data blob",
    "properties": {
        "tags": TAGS_SCHEMA,
        "notes": NOTES_SCHEMA,
    },
    "additionalProperties": False,
}


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

    def tearDown(self) -> None:
        super().tearDown()
        self.registry_patcher.stop()

    def test_simple(self):
        @self.registry.register(Action.Type.EMAIL)
        @dataclass(frozen=True)
        class EmailActionHandler(ActionHandler):
            group = ActionHandler.Group.NOTIFICATION
            config_schema = GENERIC_ACTION_CONFIG_SCHEMA
            data_schema = {}

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )
        assert len(response.data) == 1
        assert response.data == [
            {
                "type": Action.Type.EMAIL,
                "handlerGroup": ActionHandler.Group.NOTIFICATION.value,
                "configSchema": GENERIC_ACTION_CONFIG_SCHEMA,
                "dataSchema": {},
            }
        ]

    def test_integrations(self):
        @self.registry.register(Action.Type.MSTEAMS)
        @dataclass(frozen=True)
        class MSTeamsActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.NOTIFICATION
            provider_slug = "msteams"
            config_schema = MESSAGING_ACTION_CONFIG_SCHEMA
            data_schema = MOCK_DATA_SCHEMA

        @self.registry.register(Action.Type.SLACK)
        @dataclass(frozen=True)
        class SlackActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.NOTIFICATION
            provider_slug = "slack"
            config_schema = MESSAGING_ACTION_CONFIG_SCHEMA
            data_schema = MOCK_DATA_SCHEMA

        token = "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            name="My Slack Integration",
            provider="slack",
            metadata={"access_token": token, "installation_type": "born_as_bot"},
        )

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )
        assert len(response.data) == 2
        assert response.data == [
            {
                "type": Action.Type.MSTEAMS,
                "handlerGroup": ActionHandler.Group.NOTIFICATION.value,
                "configSchema": MESSAGING_ACTION_CONFIG_SCHEMA,
                "dataSchema": MOCK_DATA_SCHEMA,
                "integrations": [],
            },
            {
                "type": Action.Type.SLACK,
                "handlerGroup": ActionHandler.Group.NOTIFICATION.value,
                "configSchema": MESSAGING_ACTION_CONFIG_SCHEMA,
                "dataSchema": MOCK_DATA_SCHEMA,
                "integrations": [{"id": str(self.integration.id), "name": self.integration.name}],
            },
        ]

    def test_sentry_apps(self):
        @self.registry.register(Action.Type.SENTRY_APP)
        @dataclass(frozen=True)
        class SentryAppActionHandler(ActionHandler):
            group = ActionHandler.Group.OTHER
            config_schema = GENERIC_ACTION_CONFIG_SCHEMA
            data_schema = {}

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

        self.no_component_sentry_app = self.create_sentry_app(
            name="Poppy's Fire Sentry App",
            organization=self.organization,
            is_alertable=True,
        )
        self.no_component_sentry_app_installation = self.create_sentry_app_installation(
            slug=self.no_component_sentry_app.slug, organization=self.organization
        )

        # should not return sentry apps that are not installed
        self.create_sentry_app(
            name="Bad Sentry App",
            organization=self.organization,
            is_alertable=True,
        )

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
        )
        assert len(response.data) == 2
        assert response.data == [
            {
                "type": Action.Type.SENTRY_APP,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": GENERIC_ACTION_CONFIG_SCHEMA,
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
                "configSchema": GENERIC_ACTION_CONFIG_SCHEMA,
                "dataSchema": {},
                "sentryApp": {
                    "id": str(self.no_component_sentry_app.id),
                    "name": self.no_component_sentry_app.name,
                    "installationId": str(self.no_component_sentry_app_installation.id),
                    "status": SentryAppStatus.as_str(self.no_component_sentry_app.status),
                },
            },
        ]

    def test_actions_sorting(self):
        @self.registry.register(Action.Type.MSTEAMS)
        @dataclass(frozen=True)
        class MSTeamsActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.NOTIFICATION
            provider_slug = "msteams"
            config_schema = MESSAGING_ACTION_CONFIG_SCHEMA
            data_schema = MOCK_DATA_SCHEMA

        @self.registry.register(Action.Type.EMAIL)
        @dataclass(frozen=True)
        class EmailActionHandler(ActionHandler):
            group = ActionHandler.Group.NOTIFICATION
            config_schema = GENERIC_ACTION_CONFIG_SCHEMA
            data_schema = {}

        @self.registry.register(Action.Type.SENTRY_APP)
        @dataclass(frozen=True)
        class SentryAppActionHandler(ActionHandler):
            group = ActionHandler.Group.OTHER
            config_schema = GENERIC_ACTION_CONFIG_SCHEMA
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

        @self.registry.register(Action.Type.SLACK)
        @dataclass(frozen=True)
        class SlackActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.NOTIFICATION
            provider_slug = "slack"
            config_schema = MESSAGING_ACTION_CONFIG_SCHEMA
            data_schema = MOCK_DATA_SCHEMA

        token = "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            name="My Slack Integration",
            provider="slack",
            metadata={"access_token": token, "installation_type": "born_as_bot"},
        )

        @self.registry.register(Action.Type.JIRA)
        @dataclass(frozen=True)
        class JiraActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.TICKET_CREATION
            provider_slug = "jira"
            config_schema = {}
            data_schema = {}

        @self.registry.register(Action.Type.GITHUB)
        @dataclass(frozen=True)
        class GithubActionHandler(IntegrationActionHandler):
            group = ActionHandler.Group.TICKET_CREATION
            provider_slug = "github"
            config_schema = {}
            data_schema = {}

        @self.registry.register(Action.Type.PLUGIN)
        @dataclass(frozen=True)
        class PluginActionHandler(ActionHandler):
            group = ActionHandler.Group.OTHER

            config_schema = GENERIC_ACTION_CONFIG_SCHEMA
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
                "configSchema": GENERIC_ACTION_CONFIG_SCHEMA,
                "dataSchema": {},
            },
            {
                "type": Action.Type.MSTEAMS,
                "handlerGroup": ActionHandler.Group.NOTIFICATION.value,
                "configSchema": MESSAGING_ACTION_CONFIG_SCHEMA,
                "dataSchema": MOCK_DATA_SCHEMA,
                "integrations": [],
            },
            {
                "type": Action.Type.SLACK,
                "handlerGroup": ActionHandler.Group.NOTIFICATION.value,
                "configSchema": MESSAGING_ACTION_CONFIG_SCHEMA,
                "dataSchema": MOCK_DATA_SCHEMA,
                "integrations": [{"id": str(self.integration.id), "name": self.integration.name}],
            },
            # other actions, non sentry app actions first then sentry apps sorted alphabetically by name
            {
                "type": Action.Type.PLUGIN,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": GENERIC_ACTION_CONFIG_SCHEMA,
                "dataSchema": {},
            },
            {
                "type": Action.Type.SENTRY_APP,
                "handlerGroup": ActionHandler.Group.OTHER.value,
                "configSchema": GENERIC_ACTION_CONFIG_SCHEMA,
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
                "configSchema": GENERIC_ACTION_CONFIG_SCHEMA,
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
                "integrations": [],
            },
            {
                "type": Action.Type.JIRA,
                "handlerGroup": ActionHandler.Group.TICKET_CREATION.value,
                "configSchema": {},
                "dataSchema": {},
                "integrations": [],
            },
        ]
