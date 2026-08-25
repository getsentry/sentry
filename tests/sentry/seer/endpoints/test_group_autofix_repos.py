from unittest.mock import MagicMock, patch

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:gen-ai-features")
class GroupAutofixReposEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group()
        self.url = (
            f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/autofix/repos/"
        )

    def _create_run_mirror(self) -> None:
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=42)
        self.create_seer_agent_run(run, source="autofix", group=self.group)

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_success(self, mock_get_repos: MagicMock) -> None:
        self._create_run_mirror()
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "repos": [
                {
                    "repo_name": "owner/repo",
                    "provider": "github",
                    "owner": "owner",
                    "name": "repo",
                    "external_id": "123",
                    "default_branch": "main",
                    "has_write_access": True,
                    "has_read_access": True,
                }
            ]
        }
        mock_get_repos.return_value = mock_response

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data["repos"]) == 1
        assert response.data["repos"][0]["repo_name"] == "owner/repo"
        mock_get_repos.assert_called_once_with(42)

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_no_runs_returns_empty(self, mock_get_repos: MagicMock) -> None:
        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["repos"] == []
        mock_get_repos.assert_not_called()

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_seer_404_returns_empty(self, mock_get_repos: MagicMock) -> None:
        self._create_run_mirror()
        mock_response = MagicMock()
        mock_response.status = 404
        mock_get_repos.return_value = mock_response

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["repos"] == []

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_seer_500(self, mock_get_repos: MagicMock) -> None:
        self._create_run_mirror()
        mock_response = MagicMock()
        mock_response.status = 500
        mock_get_repos.return_value = mock_response

        response = self.client.get(self.url)

        assert response.status_code == 500

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_seer_connection_error(self, mock_get_repos: MagicMock) -> None:
        self._create_run_mirror()
        mock_get_repos.side_effect = Exception("Connection refused")

        response = self.client.get(self.url)

        assert response.status_code == 502
        assert response.data["detail"] == "Failed to reach Seer"
