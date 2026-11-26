from unittest.mock import MagicMock, patch

from sentry.integrations.source_code_management.repo_sync_status import FEATURE
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationIntegrationRepoSyncTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.integration = self.create_integration(
            organization=self.org, provider="github", name="Example", external_id="github:1"
        )
        self.path = (
            f"/api/0/organizations/{self.org.slug}/integrations/{self.integration.id}/repo-sync/"
        )

    @patch(
        "sentry.integrations.api.endpoints.organization_integration_repo_sync.sync_repos_for_org"
    )
    def test_triggers_sync(self, mock_sync: MagicMock) -> None:
        response = self.client.post(self.path, format="json")
        assert response.status_code == 202, response.content

        mock_sync.apply_async.assert_called_once()
        kwargs = mock_sync.apply_async.call_args.kwargs["kwargs"]
        assert "organization_integration_id" in kwargs

    def test_get_without_the_feature(self) -> None:
        response = self.client.get(self.path)
        assert response.status_code == 404, response.content

    @with_feature(FEATURE)
    def test_get_without_a_sync(self) -> None:
        response = self.client.get(self.path)
        assert response.status_code == 200, response.content
        assert response.data["status"] is None

    @with_feature(FEATURE)
    @patch(
        "sentry.integrations.api.endpoints.organization_integration_repo_sync.sync_repos_for_org"
    )
    def test_get_while_syncing(self, mock_sync: MagicMock) -> None:
        self.client.post(self.path, format="json")

        # Members can't start a sync, but can wait for one.
        member = self.create_user()
        self.create_member(user=member, organization=self.org, role="member")
        self.login_as(user=member)

        response = self.client.get(self.path)
        assert response.status_code == 200, response.content
        assert response.data == {"status": "syncing", "trigger": "manual", "reason": None}

    @patch(
        "sentry.integrations.api.endpoints.organization_integration_repo_sync.sync_repos_for_org"
    )
    def test_rejects_non_scm_integration(self, mock_sync: MagicMock) -> None:
        jira_integration = self.create_integration(
            organization=self.org, provider="jira", name="Jira", external_id="jira:1"
        )
        path = f"/api/0/organizations/{self.org.slug}/integrations/{jira_integration.id}/repo-sync/"
        response = self.client.post(path, format="json")
        assert response.status_code == 400
        assert "not supported" in response.data["detail"]
        mock_sync.apply_async.assert_not_called()

    @patch(
        "sentry.integrations.api.endpoints.organization_integration_repo_sync.sync_repos_for_org"
    )
    def test_rejects_nonexistent_integration(self, mock_sync: MagicMock) -> None:
        path = f"/api/0/organizations/{self.org.slug}/integrations/999999/repo-sync/"
        response = self.client.post(path, format="json")
        assert response.status_code == 404
        mock_sync.apply_async.assert_not_called()
