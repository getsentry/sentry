from unittest.mock import MagicMock, patch

from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.github.client import GitHubBaseClient
from sentry.scm.pull_request_files import (
    MAX_PR_FILES,
    fetch_pr_file_stats,
    normalize_github_pr_files,
)
from sentry.shared_integrations.response.mapping import MappingApiResponse
from sentry.shared_integrations.response.sequence import SequenceApiResponse
from sentry.testutils.cases import TestCase


def test_maps_and_churn_sorts() -> None:
    raw = [
        {
            "filename": "small.py",
            "status": "modified",
            "additions": 1,
            "deletions": 1,
            "changes": 2,
        },
        {"filename": "big.py", "status": "added", "additions": 40, "deletions": 0, "changes": 40},
    ]
    out = normalize_github_pr_files(raw)
    assert out == [
        {"path": "big.py", "additions": 40, "deletions": 0, "status": "added"},
        {"path": "small.py", "additions": 1, "deletions": 1, "status": "modified"},
    ]


def test_drops_missing_filename_and_unknown_status() -> None:
    raw = [
        {"filename": "", "status": "modified", "additions": 1, "deletions": 0},
        {"filename": "x.py", "status": "copied", "additions": 2, "deletions": 0},
        {"filename": "ok.py", "status": "removed", "additions": 0, "deletions": 5},
    ]
    out = normalize_github_pr_files(raw)
    assert out == [{"path": "ok.py", "additions": 0, "deletions": 5, "status": "removed"}]


def test_drops_non_str_status() -> None:
    raw = [
        {"filename": "weird.py", "status": ["modified"], "additions": 9, "deletions": 9},
        {"filename": "ok.py", "status": "added", "additions": 1, "deletions": 0},
    ]
    out = normalize_github_pr_files(raw)
    assert out == [{"path": "ok.py", "additions": 1, "deletions": 0, "status": "added"}]


def test_null_counts_coerced_to_zero() -> None:
    raw = [{"filename": "bin.png", "status": "modified", "additions": None, "deletions": None}]
    out = normalize_github_pr_files(raw)
    assert out == [{"path": "bin.png", "additions": 0, "deletions": 0, "status": "modified"}]


def test_empty_input() -> None:
    assert normalize_github_pr_files([]) == []


class FetchPrFileStatsTest(TestCase):
    def _repo(self):
        return self.create_repo(project=self.project, name="owner/repo")

    @patch("sentry.scm.pull_request_files._github_client_for_repository")
    def test_returns_normalized_stats(self, mock_client_for_repo) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = SequenceApiResponse(
            [{"filename": "a.py", "status": "modified", "additions": 5, "deletions": 2}]
        )
        mock_client_for_repo.return_value = client

        out = fetch_pr_file_stats(self.organization, self._repo(), "7")
        assert out == [{"path": "a.py", "additions": 5, "deletions": 2, "status": "modified"}]
        client.get_pull_request_files.assert_called_once_with("owner/repo", "7")

    @patch("sentry.scm.pull_request_files._github_client_for_repository", return_value=None)
    def test_no_client_returns_empty(self, _mock) -> None:
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files._github_client_for_repository")
    def test_fetch_error_returns_empty(self, mock_client_for_repo) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.side_effect = Exception("boom")
        mock_client_for_repo.return_value = client
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files._github_client_for_repository")
    def test_mapping_response_returns_empty(self, mock_client_for_repo) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = MappingApiResponse({"message": "Not Found"})
        mock_client_for_repo.return_value = client
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files._github_client_for_repository")
    def test_non_dict_file_entries_return_empty(self, mock_client_for_repo) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = ["x"]
        mock_client_for_repo.return_value = client
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files._github_client_for_repository")
    def test_caps_at_max_pr_files(self, mock_client_for_repo) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = [
            {"filename": f"f{i}.py", "status": "modified", "additions": 1, "deletions": 0}
            for i in range(MAX_PR_FILES + 25)
        ]
        mock_client_for_repo.return_value = client
        assert len(fetch_pr_file_stats(self.organization, self._repo(), "7")) == MAX_PR_FILES

    @patch("sentry.scm.pull_request_files._github_client_for_repository")
    def test_uses_config_name_for_repo(self, mock_client_for_repo) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = []
        mock_client_for_repo.return_value = client

        repo = self._repo()
        repo.config = {"name": "config-owner/config-repo"}
        repo.save()

        fetch_pr_file_stats(self.organization, repo, "7")
        client.get_pull_request_files.assert_called_once_with("config-owner/config-repo", "7")

    @patch("sentry.scm.pull_request_files.integration_service.get_integration")
    def test_missing_org_integration_returns_empty(self, mock_get_integration) -> None:
        installation = MagicMock()
        installation.get_client.side_effect = OrganizationIntegrationNotFound("missing")
        integration = MagicMock()
        integration.get_installation.return_value = installation
        mock_get_integration.return_value = integration

        repo = self.create_repo(project=self.project, name="owner/repo", integration_id=123)
        assert fetch_pr_file_stats(self.organization, repo, "7") == []
