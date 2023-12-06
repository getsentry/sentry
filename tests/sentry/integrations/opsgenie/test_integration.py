from functools import cached_property
from unittest.mock import patch

import pytest
import responses
from rest_framework.serializers import ValidationError

from sentry.integrations.opsgenie.integration import OpsgenieIntegrationProvider
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.rule import Rule
from sentry.tasks.integrations.migrate_opsgenie_plugins import (
    ALERT_LEGACY_INTEGRATIONS,
    ALERT_LEGACY_INTEGRATIONS_WITH_NAME,
)
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.silo import control_silo_test
from sentry_plugins.opsgenie.plugin import OpsGeniePlugin

EXTERNAL_ID = "test-app"
METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.opsgenie.com/",
    "domain_name": "test-app.app.opsgenie.com",
}


@control_silo_test
class OpsgenieIntegrationTest(IntegrationTestCase):
    provider = OpsgenieIntegrationProvider
    config_no_key = {
        "base_url": "https://api.opsgenie.com/",
        "provider": "cool-name",
        "api_key": "",
    }
    config_with_key = {
        "base_url": "https://api.opsgenie.com/",
        "provider": "cool-name",
        "api_key": "123-key",
    }
    eu_config_no_key = {
        "base_url": "https://api.eu.opsgenie.com/",
        "provider": "chill-name",
        "api_key": "",
    }
    eu_config_with_key = {
        "base_url": "https://api.eu.opsgenie.com/",
        "provider": "chill-name",
        "api_key": "123-key",
    }

    def setUp(self):
        super().setUp()
        self.init_path_without_guide = f"{self.init_path}?completed_installation_guide"

    def assert_setup_flow(self, config):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200

        resp = self.client.post(self.init_path, data=config)
        assert resp.status_code == 200

    def test_installation_no_key(self):
        self.assert_setup_flow(self.config_no_key)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        assert org_integration.config["team_table"] == []
        assert org_integration.organization_id == self.organization.id
        assert org_integration.config == {"team_table": []}
        assert integration.external_id == "cool-name"
        assert integration.name == "cool-name"
        assert integration.metadata["domain_name"] == "cool-name.app.opsgenie.com"

    def test_eu_installation_no_key(self):
        self.assert_setup_flow(self.eu_config_no_key)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        assert org_integration.config["team_table"] == []
        assert org_integration.organization_id == self.organization.id
        assert org_integration.config == {"team_table": []}
        assert integration.external_id == "chill-name"
        assert integration.name == "chill-name"
        assert integration.metadata["domain_name"] == "chill-name.app.eu.opsgenie.com"

    def test_installation_with_key(self):
        self.assert_setup_flow(self.config_with_key)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        assert org_integration.config["team_table"] == [
            {
                "team": "my-first-key",
                "id": f"{org_integration.id}-my-first-key",
                "integration_key": "123-key",
            }
        ]
        assert org_integration.organization_id == self.organization.id
        assert integration.external_id == "cool-name"
        assert integration.name == "cool-name"
        assert integration.metadata["domain_name"] == "cool-name.app.opsgenie.com"

    def test_eu_installation_with_key(self):
        self.assert_setup_flow(self.eu_config_with_key)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        assert org_integration.config["team_table"] == [
            {
                "team": "my-first-key",
                "id": f"{org_integration.id}-my-first-key",
                "integration_key": "123-key",
            }
        ]
        assert org_integration.organization_id == self.organization.id
        assert integration.external_id == "chill-name"
        assert integration.name == "chill-name"
        assert integration.metadata["domain_name"] == "chill-name.app.eu.opsgenie.com"

    @responses.activate
    def test_update_config_valid(self):
        integration = Integration.objects.create(
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )

        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        data = {"team_table": [{"id": "", "team": "cool-team", "integration_key": "1234-5678"}]}
        installation.update_organization_config(data)
        team_id = str(org_integration.id) + "-" + "cool-team"
        assert installation.get_config_data() == {
            "team_table": [{"id": team_id, "team": "cool-team", "integration_key": "1234-5678"}]
        }

    @responses.activate
    def test_update_config_invalid(self):
        integration = Integration.objects.create(
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )

        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)
        team_id = str(org_integration.id) + "-" + "cool-team"

        # valid
        data = {"team_table": [{"id": "", "team": "cool-team", "integration_key": "1234"}]}
        installation.update_organization_config(data)
        assert installation.get_config_data() == {
            "team_table": [{"id": team_id, "team": "cool-team", "integration_key": "1234"}]
        }

        # try duplicate name
        data = {
            "team_table": [
                {"id": team_id, "team": "cool-team", "integration_key": "1234"},
                {"id": "", "team": "cool-team", "integration_key": "1234"},
            ]
        }
        with pytest.raises(ValidationError):
            installation.update_organization_config(data)
        assert installation.get_config_data() == {
            "team_table": [{"id": team_id, "team": "cool-team", "integration_key": "1234"}]
        }


class OpsgenieMigrationIntegrationTest(APITestCase):
    @cached_property
    def integration(self):
        integration = Integration.objects.create(
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )
        integration.add_organization(self.organization, self.user)
        return integration

    def setUp(self):
        super().setUp()
        self.project = self.create_project(
            name="thonk", organization=self.organization, teams=[self.team]
        )
        self.plugin = OpsGeniePlugin()
        self.plugin.set_option("enabled", True, self.project)
        self.plugin.set_option("alert_url", "https://api.opsgenie.com/v2/alerts/", self.project)
        self.plugin.set_option("api_key", "123-key", self.project)
        self.installation = self.integration.get_installation(self.organization.id)
        self.login_as(self.user)

    @patch("sentry.tasks.integrations.migrate_opsgenie_plugins.metrics")
    def test_migrate_plugin(self, mock_metrics):
        """
        Test that 2 projects with the Opsgenie plugin activated that have one alert rule each
        and distinct API keys are successfully migrated.
        """
        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        org_integration.config = {"team_table": []}
        org_integration.save()

        project2 = self.create_project(
            name="thinkies", organization=self.organization, teams=[self.team]
        )
        plugin2 = OpsGeniePlugin()
        plugin2.set_option("enabled", True, project2)
        plugin2.set_option("alert_url", "https://api.opsgenie.com/v2/alerts/", project2)
        plugin2.set_option("api_key", "456-key", project2)

        Rule.objects.create(
            label="rule",
            project=self.project,
            data={"match": "all", "actions": [ALERT_LEGACY_INTEGRATIONS]},
        )

        Rule.objects.create(
            label="rule2",
            project=project2,
            data={"match": "all", "actions": [ALERT_LEGACY_INTEGRATIONS]},
        )

        with self.tasks():
            self.installation.schedule_migrate_opsgenie_plugin()

        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        id1 = str(self.organization_integration.id) + "-thonk"
        id2 = str(self.organization_integration.id) + "-thinkies"
        assert org_integration.config == {
            "team_table": [
                {"id": id1, "team": "thonk [MIGRATED]", "integration_key": "123-key"},
                {"id": id2, "team": "thinkies [MIGRATED]", "integration_key": "456-key"},
            ]
        }

        rule_updated = Rule.objects.get(
            label="rule",
            project=self.project,
        )

        assert rule_updated.data["actions"] == [
            ALERT_LEGACY_INTEGRATIONS,
            {
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                "account": self.integration.id,
                "team": id1,
            },
        ]

        rule2_updated = Rule.objects.get(
            label="rule2",
            project=project2,
        )
        assert rule2_updated.data["actions"] == [
            ALERT_LEGACY_INTEGRATIONS,
            {
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                "account": self.integration.id,
                "team": id2,
            },
        ]

        assert self.plugin.is_enabled(self.project) is False
        assert self.plugin.is_configured(self.project) is False
        assert plugin2.is_enabled(project2) is False
        assert plugin2.is_configured(self.project) is False
        mock_metrics.incr.assert_any_call("opsgenie.migration_success", skip_internal=False)

    def test_no_duplicate_keys(self):
        """
        Keys should not be migrated twice.
        """
        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        org_integration.config = {"team_table": []}
        org_integration.save()

        project2 = self.create_project(
            name="thinkies", organization=self.organization, teams=[self.team]
        )
        plugin2 = OpsGeniePlugin()
        plugin2.set_option("enabled", True, project2)
        plugin2.set_option("alert_url", "https://api.opsgenie.com/v2/alerts/", project2)
        plugin2.set_option("api_key", "123-key", project2)

        with self.tasks():
            self.installation.schedule_migrate_opsgenie_plugin()

        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        id1 = str(self.organization_integration.id) + "-thonk"

        assert org_integration.config == {
            "team_table": [
                {"id": id1, "team": "thonk [MIGRATED]", "integration_key": "123-key"},
            ]
        }

    def test_existing_key(self):
        """
        Test that migration works if a key has already been added to config.
        """
        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        org_integration.config = {
            "team_table": [
                {
                    "id": str(self.organization_integration.id) + "-pikachu",
                    "team": "pikachu",
                    "integration_key": "123-key",
                },
            ]
        }
        org_integration.save()

        Rule.objects.create(
            label="rule",
            project=self.project,
            data={"match": "all", "actions": [ALERT_LEGACY_INTEGRATIONS]},
        )
        with self.tasks():
            self.installation.schedule_migrate_opsgenie_plugin()

        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        assert org_integration.config == {
            "team_table": [
                {
                    "id": str(self.organization_integration.id) + "-pikachu",
                    "team": "pikachu",
                    "integration_key": "123-key",
                },
            ]
        }

        rule_updated = Rule.objects.get(
            label="rule",
            project=self.project,
        )

        assert rule_updated.data["actions"] == [
            ALERT_LEGACY_INTEGRATIONS,
            {
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                "account": self.integration.id,
                "team": str(self.organization_integration.id) + "-pikachu",
            },
        ]

    def test_multiple_rules(self):
        """
        Test multiple rules, some of which send notifications to legacy integrations.
        """
        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        org_integration.config = {"team_table": []}
        org_integration.save()

        Rule.objects.create(
            label="rule",
            project=self.project,
            data={"match": "all", "actions": [ALERT_LEGACY_INTEGRATIONS]},
        )

        Rule.objects.create(
            label="rule2",
            project=self.project,
            data={"match": "all", "actions": []},
        )

        with self.tasks():
            self.installation.schedule_migrate_opsgenie_plugin()

        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        id1 = str(self.organization_integration.id) + "-thonk"
        rule_updated = Rule.objects.get(
            label="rule",
            project=self.project,
        )

        assert rule_updated.data["actions"] == [
            ALERT_LEGACY_INTEGRATIONS,
            {
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                "account": self.integration.id,
                "team": id1,
            },
        ]

        rule2_updated = Rule.objects.get(
            label="rule2",
            project=self.project,
        )

        assert rule2_updated.data["actions"] == []

    def test_existing_rule(self):
        """
        Don't add a new recipient from an API key if the recipient already exists.
        """
        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        org_integration.config = {
            "team_table": [
                {
                    "id": str(self.organization_integration.id) + "-pikachu",
                    "team": "pikachu",
                    "integration_key": "123-key",
                },
            ]
        }
        org_integration.save()

        Rule.objects.create(
            label="rule",
            project=self.project,
            data={
                "match": "all",
                "actions": [
                    ALERT_LEGACY_INTEGRATIONS,
                    {
                        "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                        "account": self.integration.id,
                        "team": str(self.organization_integration.id) + "-pikachu",
                    },
                ],
            },
        )
        with self.tasks():
            self.installation.schedule_migrate_opsgenie_plugin()

        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        assert org_integration.config == {
            "team_table": [
                {
                    "id": str(self.organization_integration.id) + "-pikachu",
                    "team": "pikachu",
                    "integration_key": "123-key",
                },
            ]
        }

        rule_updated = Rule.objects.get(
            label="rule",
            project=self.project,
        )

        assert rule_updated.data["actions"] == [
            ALERT_LEGACY_INTEGRATIONS,
            {
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                "account": self.integration.id,
                "team": str(self.organization_integration.id) + "-pikachu",
            },
        ]

    def test_migrate_plugin_with_name(self):
        """
        Test that the Opsgenie plugin is migrated correctly if the legacy alert action has a name field.
        """
        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        org_integration.config = {"team_table": []}
        org_integration.save()

        Rule.objects.create(
            label="rule",
            project=self.project,
            data={"match": "all", "actions": [ALERT_LEGACY_INTEGRATIONS_WITH_NAME]},
        )

        with self.tasks():
            self.installation.schedule_migrate_opsgenie_plugin()

        org_integration = OrganizationIntegration.objects.get(integration_id=self.integration.id)
        id1 = str(self.organization_integration.id) + "-thonk"
        assert org_integration.config == {
            "team_table": [
                {"id": id1, "team": "thonk [MIGRATED]", "integration_key": "123-key"},
            ]
        }

        rule_updated = Rule.objects.get(
            label="rule",
            project=self.project,
        )

        assert rule_updated.data["actions"] == [
            ALERT_LEGACY_INTEGRATIONS,
            {
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                "account": self.integration.id,
                "team": id1,
            },
        ]

        assert self.plugin.is_enabled(self.project) is False
        assert self.plugin.is_configured(self.project) is False
