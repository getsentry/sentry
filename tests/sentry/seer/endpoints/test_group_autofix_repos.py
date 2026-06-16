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

    @patch("sentry.seer.endpoints.group_autofix_repos.SeerAgentClient")
    def test_success(self, mock_client_cls: MagicMock) -> None:
        mock_run = MagicMock()
        mock_run.run_id = 42
        mock_client = MagicMock()
        mock_client.get_runs.return_value = [mock_run]

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
        mock_client.get_repos.return_value = mock_response
        mock_client_cls.return_value = mock_client

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data["repos"]) == 1
        assert response.data["repos"][0]["repo_name"] == "owner/repo"
        mock_client.get_repos.assert_called_once_with(42)

    @patch("sentry.seer.endpoints.group_autofix_repos.SeerAgentClient")
    def test_no_runs_returns_empty(self, mock_client_cls: MagicMock) -> None:
        mock_client = MagicMock()
        mock_client.get_runs.return_value = []
        mock_client_cls.return_value = mock_client

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["repos"] == []

    @patch("sentry.seer.endpoints.group_autofix_repos.SeerAgentClient")
    def test_seer_404_returns_empty(self, mock_client_cls: MagicMock) -> None:
        mock_run = MagicMock()
        mock_run.run_id = 42
        mock_client = MagicMock()
        mock_client.get_runs.return_value = [mock_run]

        mock_response = MagicMock()
        mock_response.status = 404
        mock_client.get_repos.return_value = mock_response
        mock_client_cls.return_value = mock_client

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["repos"] == []

    @patch("sentry.seer.endpoints.group_autofix_repos.SeerAgentClient")
    def test_seer_500(self, mock_client_cls: MagicMock) -> None:
        mock_run = MagicMock()
        mock_run.run_id = 42
        mock_client = MagicMock()
        mock_client.get_runs.return_value = [mock_run]

        mock_response = MagicMock()
        mock_response.status = 500
        mock_client.get_repos.return_value = mock_response
        mock_client_cls.return_value = mock_client

        response = self.client.get(self.url)

        assert response.status_code == 500

    @patch("sentry.seer.endpoints.group_autofix_repos.SeerAgentClient")
    def test_seer_connection_error(self, mock_client_cls: MagicMock) -> None:
        mock_run = MagicMock()
        mock_run.run_id = 42
        mock_client = MagicMock()
        mock_client.get_runs.return_value = [mock_run]
        mock_client.get_repos.side_effect = Exception("Connection refused")
        mock_client_cls.return_value = mock_client

        response = self.client.get(self.url)

        assert response.status_code == 502
        assert response.data["detail"] == "Failed to reach Seer"
