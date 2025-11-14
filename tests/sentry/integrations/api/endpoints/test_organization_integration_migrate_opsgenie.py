from typing import int
from unittest.mock import MagicMock, patch

from sentry.testutils.cases import APITestCase


class OrganizationIntegrationMigrateOpsgenieTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.organization = self.create_organization(owner=self.user)

    def get_path(self, integration_id) -> str:
        return f"/api/0/organizations/{self.organization.slug}/integrations/{integration_id}/migrate-opsgenie/"

    def test_no_integration(self) -> None:
        path = self.get_path(integration_id=-1)
        response = self.client.put(path, format="json")
        assert response.status_code == 404

    def test_not_opsgenie_integration(self) -> None:
        integration = self.create_integration(
            organization=self.organization, provider="jira", external_id="jira:1"
        )
        path = self.get_path(integration_id=integration.id)
        response = self.client.put(path, format="json")
        assert response.status_code == 400

    @patch("sentry.integrations.api.endpoints.organization_integration_migrate_opsgenie.metrics")
    @patch(
        "sentry.integrations.opsgenie.integration.OpsgenieIntegration.schedule_migrate_opsgenie_plugin"
    )
    def test_simple(self, mock_migrate_opsgenie_plugin: MagicMock, mock_metrics: MagicMock) -> None:
        integration = self.create_integration(
            organization=self.organization, provider="opsgenie", external_id="cool_opsgenie"
        )
        path = self.get_path(integration_id=integration.id)
        response = self.client.put(path, format="json")
        assert response.status_code == 202
        assert mock_migrate_opsgenie_plugin.called
        mock_metrics.incr.assert_any_call("opsgenie.migration_attempt", skip_internal=False)
