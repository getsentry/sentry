from unittest.mock import MagicMock, patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:gen-ai-features")
class OrganizationSeerAutofixReposEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/autofix-repos/"

    def _create_run_mirror(self, group, seer_run_state_id: int) -> None:
        run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=seer_run_state_id
        )
        self.create_seer_agent_run(run, source="autofix", group=group)

    def _repos_response(self, repo_name: str) -> MagicMock:
        response = MagicMock()
        response.status = 200
        response.json.return_value = {
            "repos": [
                {
                    "repo_name": repo_name,
                    "provider": "github",
                    "owner": "owner",
                    "name": repo_name.split("/")[-1],
                    "external_id": "123",
                    "default_branch": "main",
                    "has_write_access": True,
                    "has_read_access": True,
                }
            ]
        }
        return response

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_batches_repos_for_multiple_groups(self, mock_get_repos: MagicMock) -> None:
        group_one = self.create_group()
        group_two = self.create_group()
        self._create_run_mirror(group_one, 42)
        self._create_run_mirror(group_two, 43)

        def fake_get_repos(run_id: int) -> MagicMock:
            return self._repos_response(f"owner/repo-{run_id}")

        mock_get_repos.side_effect = fake_get_repos

        response = self.client.get(self.url, {"group": [group_one.id, group_two.id]})

        assert response.status_code == 200
        assert response.data[str(group_one.id)]["repos"][0]["repo_name"] == "owner/repo-42"
        assert response.data[str(group_two.id)]["repos"][0]["repo_name"] == "owner/repo-43"
        # One Seer call per group, not one per card render.
        assert mock_get_repos.call_count == 2

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_group_without_run_returns_empty(self, mock_get_repos: MagicMock) -> None:
        group = self.create_group()

        response = self.client.get(self.url, {"group": [group.id]})

        assert response.status_code == 200
        assert response.data[str(group.id)] == {"repos": []}
        mock_get_repos.assert_not_called()

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_seer_404_returns_empty(self, mock_get_repos: MagicMock) -> None:
        group = self.create_group()
        self._create_run_mirror(group, 42)
        not_found = MagicMock()
        not_found.status = 404
        mock_get_repos.return_value = not_found

        response = self.client.get(self.url, {"group": [group.id]})

        assert response.status_code == 200
        assert response.data[str(group.id)] == {"repos": []}

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_omits_group_when_seer_fails(self, mock_get_repos: MagicMock) -> None:
        good = self.create_group()
        bad = self.create_group()
        self._create_run_mirror(good, 42)
        self._create_run_mirror(bad, 43)

        def fake_get_repos(run_id: int) -> MagicMock:
            if run_id == 43:
                raise Exception("Connection refused")
            return self._repos_response("owner/good")

        mock_get_repos.side_effect = fake_get_repos

        response = self.client.get(self.url, {"group": [good.id, bad.id]})

        assert response.status_code == 200
        # A single group's Seer failure must not fabricate empty repos or fail the batch.
        assert response.data[str(good.id)]["repos"][0]["repo_name"] == "owner/good"
        assert str(bad.id) not in response.data

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_excludes_groups_outside_org(self, mock_get_repos: MagicMock) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_group = self.create_group(project=other_project)

        response = self.client.get(self.url, {"group": [other_group.id]})

        assert response.status_code == 200
        assert response.data == {}
        mock_get_repos.assert_not_called()

    @patch("sentry.seer.agent.client.SeerAgentClient.get_repos")
    def test_no_groups_returns_empty(self, mock_get_repos: MagicMock) -> None:
        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data == {}
        mock_get_repos.assert_not_called()
