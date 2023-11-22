from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationIntegrationIssuesTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.organization = self.create_organization(owner=self.user)

    def get_path(self, integration_id):
        return (
            f"/api/0/organizations/{self.organization.slug}/integrations/{integration_id}/issues/"
        )

    def test_no_integration(self):
        path = self.get_path(integration_id=-1)
        response = self.client.put(path, format="json")
        assert response.status_code == 404

    def test_not_issue_integration(self):
        integration = self.create_integration(
            organization=self.organization, provider="slack", external_id="slack:1"
        )
        path = self.get_path(integration_id=integration.id)
        response = self.client.put(path, format="json")
        assert response.status_code == 400

    @patch("sentry.integrations.jira.integration.JiraIntegration.migrate_issues")
    def test_simple(self, mock_migrate_issues):
        integration = self.create_integration(
            organization=self.organization, provider="jira", external_id="jira:1"
        )
        path = self.get_path(integration_id=integration.id)
        response = self.client.put(path, format="json")
        assert response.status_code == 204
        assert mock_migrate_issues.called
