"""
Tests for GitHub team synchronization API endpoint.
"""
from unittest.mock import patch

from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature


class OrganizationGitHubTeamSyncEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user, name="Test Org")
        self.team = self.create_team(organization=self.organization, name="test-team")
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="12345",
            provider="github",
            name="test-org",
            metadata={
                "account": {"login": "test-org", "id": 54321},
                "installation": {"id": 12345},
            },
        )
        self.path = f"/api/0/organizations/{self.organization.slug}/github-team-sync/"

    def test_requires_org_integrations_permission(self):
        """Test that the endpoint requires org:integrations permission."""
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(user=member)

        response = self.client.post(self.path)
        assert response.status_code == 403

    def test_returns_404_when_no_github_teams(self):
        """Test that endpoint returns 404 when organization has no GitHub team mappings."""
        self.login_as(user=self.user)

        response = self.client.post(self.path)
        
        assert response.status_code == 404
        assert "No GitHub team mappings found" in response.data["detail"]
        assert response.data["organization_id"] == self.organization.id

    @patch("sentry.tasks.github_team_sync.sync_github_teams_for_organization.delay")
    def test_queues_sync_task_when_github_teams_exist(self, mock_delay):
        """Test that sync task is queued when organization has GitHub team mappings."""
        # Create a GitHub team mapping
        ExternalActor.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.GITHUB.value,
            external_name="@test-team",
            external_id="team-123",
            team=self.team,
        )

        self.login_as(user=self.user)

        response = self.client.post(self.path)

        assert response.status_code == 202
        assert "synchronization has been queued" in response.data["detail"]
        assert response.data["organization_id"] == self.organization.id
        assert response.data["organization_slug"] == self.organization.slug

        mock_delay.assert_called_once_with(self.organization.id)

    @patch("sentry.tasks.github_team_sync.sync_github_teams_for_organization.delay")
    def test_works_with_github_enterprise_teams(self, mock_delay):
        """Test that endpoint works with GitHub Enterprise team mappings."""
        # Create a GitHub Enterprise team mapping
        ExternalActor.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.GITHUB_ENTERPRISE.value,
            external_name="@enterprise-team",
            external_id="team-456",
            team=self.team,
        )

        self.login_as(user=self.user)

        response = self.client.post(self.path)

        assert response.status_code == 202
        mock_delay.assert_called_once_with(self.organization.id)

    def test_only_accepts_post_requests(self):
        """Test that endpoint only accepts POST requests."""
        # Create a GitHub team mapping
        ExternalActor.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.GITHUB.value,
            external_name="@test-team",
            external_id="team-123",
            team=self.team,
        )

        self.login_as(user=self.user)

        # Test unsupported methods
        response = self.client.get(self.path)
        assert response.status_code == 405

        response = self.client.put(self.path)
        assert response.status_code == 405

        response = self.client.delete(self.path)
        assert response.status_code == 405

    def test_requires_authentication(self):
        """Test that endpoint requires authentication."""
        response = self.client.post(self.path)
        assert response.status_code == 401

    @patch("sentry.tasks.github_team_sync.sync_github_teams_for_organization.delay")
    def test_ignores_user_mappings(self, mock_delay):
        """Test that endpoint ignores GitHub user mappings and only considers team mappings."""
        # Create a GitHub user mapping (should be ignored)
        ExternalActor.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.GITHUB.value,
            external_name="@github-user",
            external_id="user-123",
            user_id=self.user.id,  # User mapping, not team
        )

        self.login_as(user=self.user)

        response = self.client.post(self.path)

        # Should return 404 because no team mappings exist
        assert response.status_code == 404
        assert "No GitHub team mappings found" in response.data["detail"]
        mock_delay.assert_not_called()

    @patch("sentry.tasks.github_team_sync.sync_github_teams_for_organization.delay")
    def test_handles_mixed_provider_mappings(self, mock_delay):
        """Test that endpoint works when organization has mixed provider team mappings."""
        # Create GitHub team mapping
        ExternalActor.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.GITHUB.value,
            external_name="@github-team",
            external_id="team-123",
            team=self.team,
        )

        # Create Slack team mapping (should be ignored for GitHub sync)
        slack_integration = self.create_integration(
            organization=self.organization,
            external_id="slack-123",
            provider="slack",
            name="slack-workspace",
        )
        ExternalActor.objects.create(
            organization=self.organization,
            integration_id=slack_integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="#slack-team",
            external_id="slack-team-456",
            team=self.team,
        )

        self.login_as(user=self.user)

        response = self.client.post(self.path)

        # Should queue sync because GitHub team mapping exists
        assert response.status_code == 202
        mock_delay.assert_called_once_with(self.organization.id)