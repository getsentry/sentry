"""
Tests for GitHub team synchronization tasks.
"""

from unittest.mock import Mock, patch

import pytest

from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.tasks.github_team_sync import (
    _fetch_github_teams,
    _sync_teams_for_integration,
    schedule_github_team_sync,
    sync_github_teams_for_organization,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time


class GitHubTeamSyncTestCase(TestCase):
    def setUp(self):
        self.organization = self.create_organization(slug="test-org")
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


class TestScheduleGitHubTeamSync(GitHubTeamSyncTestCase):
    @patch("sentry.tasks.github_team_sync.sync_github_teams_for_organization.delay")
    def test_schedules_sync_for_organizations_with_github_teams(self, mock_delay):
        """Test that sync is scheduled only for organizations with GitHub team mappings."""
        # Create GitHub team mapping
        ExternalActor.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.GITHUB.value,
            external_name="@test-team",
            external_id="team-123",
            team=self.team,
        )

        # Create organization without GitHub teams
        other_org = self.create_organization(slug="no-teams-org")

        schedule_github_team_sync()

        # Should only schedule sync for organization with GitHub teams
        mock_delay.assert_called_once_with(self.organization.id)

    @patch("sentry.tasks.github_team_sync.sync_github_teams_for_organization.delay")
    def test_handles_multiple_organizations(self, mock_delay):
        """Test scheduling sync for multiple organizations."""
        # Create another organization with GitHub teams
        other_org = self.create_organization(slug="other-org")
        other_team = self.create_team(organization=other_org, name="other-team")
        other_integration = self.create_integration(
            organization=other_org,
            external_id="67890",
            provider="github",
            name="other-org",
        )

        # Create team mappings for both organizations
        ExternalActor.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.GITHUB.value,
            external_name="@test-team",
            external_id="team-123",
            team=self.team,
        )
        ExternalActor.objects.create(
            organization=other_org,
            integration_id=other_integration.id,
            provider=ExternalProviders.GITHUB.value,
            external_name="@other-team",
            external_id="team-456",
            team=other_team,
        )

        schedule_github_team_sync()

        # Should schedule sync for both organizations
        assert mock_delay.call_count == 2
        called_org_ids = {call[0][0] for call in mock_delay.call_args_list}
        assert called_org_ids == {self.organization.id, other_org.id}


class TestSyncGitHubTeamsForOrganization(GitHubTeamSyncTestCase):
    @patch("sentry.tasks.github_team_sync._sync_teams_for_integration")
    @patch("sentry.integrations.services.integration.service.integration_service")
    def test_syncs_all_github_integrations(self, mock_service, mock_sync_teams):
        """Test that sync processes all GitHub integrations for an organization."""
        mock_integration = Mock()
        mock_integration.id = self.integration.id
        mock_service.get_integrations.return_value = [mock_integration]
        mock_sync_teams.return_value = (5, 2)  # (synced, updated)

        sync_github_teams_for_organization(self.organization.id)

        mock_service.get_integrations.assert_called_once_with(
            organization_id=self.organization.id,
            providers=["github", "github_enterprise"],
            status=1,
        )
        mock_sync_teams.assert_called_once_with(self.organization, mock_integration)

    def test_handles_nonexistent_organization(self):
        """Test handling of nonexistent organization ID."""
        with pytest.raises(Organization.DoesNotExist):
            sync_github_teams_for_organization(99999)

    @patch("sentry.integrations.services.integration.service.integration_service")
    def test_handles_no_integrations(self, mock_service):
        """Test handling when organization has no GitHub integrations."""
        mock_service.get_integrations.return_value = []

        # Should complete without error
        sync_github_teams_for_organization(self.organization.id)

        mock_service.get_integrations.assert_called_once()


class TestSyncTeamsForIntegration(GitHubTeamSyncTestCase):
    def setUp(self):
        super().setUp()
        self.external_actor = ExternalActor.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.GITHUB.value,
            external_name="@old-team-name",
            external_id="team-123",
            team=self.team,
        )

    @patch("sentry.tasks.github_team_sync._fetch_github_teams")
    def test_updates_team_name_when_changed(self, mock_fetch):
        """Test that team names are updated when they change on GitHub."""
        # Mock GitHub API response with new team name
        mock_fetch.return_value = [
            {"id": "team-123", "name": "new-team-name", "slug": "new-team-name"}
        ]

        mock_integration = Mock()
        mock_integration.id = self.integration.id
        mock_integration.provider = "github"
        mock_integration.get_installation.return_value.get_client.return_value = Mock()

        synced, updated = _sync_teams_for_integration(self.organization, mock_integration)

        # Refresh from database
        self.external_actor.refresh_from_db()

        assert self.external_actor.external_name == "@new-team-name"
        assert synced == 1
        assert updated == 1

    @patch("sentry.tasks.github_team_sync._fetch_github_teams")
    def test_no_update_when_name_unchanged(self, mock_fetch):
        """Test that no update occurs when team name is unchanged."""
        # Mock GitHub API response with same team name
        mock_fetch.return_value = [
            {"id": "team-123", "name": "old-team-name", "slug": "old-team-name"}
        ]

        mock_integration = Mock()
        mock_integration.id = self.integration.id
        mock_integration.provider = "github"
        mock_integration.get_installation.return_value.get_client.return_value = Mock()

        synced, updated = _sync_teams_for_integration(self.organization, mock_integration)

        # Should remain unchanged
        self.external_actor.refresh_from_db()
        assert self.external_actor.external_name == "@old-team-name"
        assert synced == 1
        assert updated == 0

    @patch("sentry.tasks.github_team_sync._fetch_github_teams")
    def test_handles_team_not_found_on_github(self, mock_fetch):
        """Test handling when a stored team is not found on GitHub."""
        # Mock GitHub API response without our team
        mock_fetch.return_value = [
            {"id": "other-team-456", "name": "other-team", "slug": "other-team"}
        ]

        mock_integration = Mock()
        mock_integration.id = self.integration.id
        mock_integration.provider = "github"
        mock_integration.get_installation.return_value.get_client.return_value = Mock()

        synced, updated = _sync_teams_for_integration(self.organization, mock_integration)

        # Should not update the external actor
        self.external_actor.refresh_from_db()
        assert self.external_actor.external_name == "@old-team-name"
        assert synced == 1
        assert updated == 0

    def test_handles_no_stored_teams(self):
        """Test handling when organization has no stored GitHub teams."""
        # Delete the external actor
        self.external_actor.delete()

        mock_integration = Mock()
        mock_integration.id = self.integration.id
        mock_integration.provider = "github"

        synced, updated = _sync_teams_for_integration(self.organization, mock_integration)

        assert synced == 0
        assert updated == 0


class TestFetchGitHubTeams(GitHubTeamSyncTestCase):
    def test_fetches_teams_from_github_api(self):
        """Test fetching teams from GitHub API."""
        mock_client = Mock()
        mock_client.get_organization_teams.return_value = [
            {"id": "team-123", "name": "team-one", "slug": "team-one"},
            {"id": "team-456", "name": "team-two", "slug": "team-two"},
        ]

        mock_integration = Mock()
        mock_integration.id = self.integration.id
        mock_integration.metadata = {"account": {"login": "test-org"}}

        teams = _fetch_github_teams(mock_client, mock_integration)

        mock_client.get_organization_teams.assert_called_once_with("test-org")
        assert len(teams) == 2
        assert teams[0]["name"] == "team-one"
        assert teams[1]["name"] == "team-two"

    def test_handles_missing_organization_name(self):
        """Test handling when integration metadata is missing organization name."""
        mock_client = Mock()
        mock_integration = Mock()
        mock_integration.id = self.integration.id
        mock_integration.metadata = {}

        with pytest.raises(ValueError, match="No organization name found"):
            _fetch_github_teams(mock_client, mock_integration)

    def test_handles_api_error(self):
        """Test handling GitHub API errors."""
        mock_client = Mock()
        mock_client.get_organization_teams.side_effect = Exception("API Error")

        mock_integration = Mock()
        mock_integration.id = self.integration.id
        mock_integration.metadata = {"account": {"login": "test-org"}}

        with pytest.raises(Exception, match="API Error"):
            _fetch_github_teams(mock_client, mock_integration)
