from unittest.mock import MagicMock, PropertyMock, patch

from sentry.integrations.github.client import GitHubBaseClient
from sentry.models.repository import Repository
from sentry.scm.pull_request_files import (
    MAX_PR_FILES,
    fetch_pr_file_stats,
    normalize_github_pr_files,
)
from sentry.shared_integrations.response.mapping import MappingApiResponse
from sentry.shared_integrations.response.sequence import SequenceApiResponse
from sentry.shared_integrations.response.text import TextApiResponse
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


def test_empty_input() -> None:
    assert normalize_github_pr_files([]) == []


class FetchPrFileStatsTest(TestCase):
    def _repo(self):
        return self.create_repo(project=self.project, name="owner/repo")

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_returns_normalized_stats(self, mock_get_client) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = [
            {"filename": "a.py", "status": "modified", "additions": 5, "deletions": 2},
        ]
        mock_get_client.return_value = client

        out = fetch_pr_file_stats(self.organization, self._repo(), "7")
        assert out == [{"path": "a.py", "additions": 5, "deletions": 2, "status": "modified"}]
        client.get_pull_request_files.assert_called_once_with("owner/repo", "7")

    @patch("sentry.scm.pull_request_files.get_github_client", return_value=None)
    def test_no_client_returns_empty(self, _mock) -> None:
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files.get_github_client", side_effect=Exception("boom"))
    def test_client_resolution_error_returns_empty(self, _mock) -> None:
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_fetch_error_returns_empty(self, mock_get_client) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.side_effect = Exception("boom")
        mock_get_client.return_value = client
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_empty_response_returns_empty(self, mock_get_client) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = []
        mock_get_client.return_value = client
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_mapping_response_returns_empty(self, mock_get_client) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = MappingApiResponse({"message": "Not Found"})
        mock_get_client.return_value = client
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_text_response_returns_empty(self, mock_get_client) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = TextApiResponse("", {}, 200)
        mock_get_client.return_value = client
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_sequence_response_is_normalized(self, mock_get_client) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = SequenceApiResponse(
            [{"filename": "a.py", "status": "modified", "additions": 5, "deletions": 2}]
        )
        mock_get_client.return_value = client
        out = fetch_pr_file_stats(self.organization, self._repo(), "7")
        assert out == [{"path": "a.py", "additions": 5, "deletions": 2, "status": "modified"}]

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_non_dict_file_entries_return_empty(self, mock_get_client) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = ["x"]
        mock_get_client.return_value = client
        assert fetch_pr_file_stats(self.organization, self._repo(), "7") == []

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_non_dict_repository_config_falls_back_to_name(self, mock_get_client) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = []
        mock_get_client.return_value = client

        repo = self._repo()
        repo.config = ["not", "a", "dict"]

        assert fetch_pr_file_stats(self.organization, repo, "7") == []
        mock_get_client.assert_called_once_with(self.organization, "owner/repo")

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_repository_config_access_error_returns_empty(self, mock_get_client) -> None:
        repo = MagicMock(spec=Repository)
        type(repo).config = PropertyMock(side_effect=Exception("deferred field"))

        assert fetch_pr_file_stats(self.organization, repo, "7") == []
        mock_get_client.assert_not_called()

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_caps_at_max_pr_files(self, mock_get_client) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = [
            {"filename": f"f{i}.py", "status": "modified", "additions": 1, "deletions": 0}
            for i in range(MAX_PR_FILES + 25)
        ]
        mock_get_client.return_value = client
        assert len(fetch_pr_file_stats(self.organization, self._repo(), "7")) == MAX_PR_FILES

    @patch("sentry.scm.pull_request_files.get_github_client")
    def test_uses_config_name_for_repo(self, mock_get_client) -> None:
        client = MagicMock(spec=GitHubBaseClient)
        client.get_pull_request_files.return_value = []
        mock_get_client.return_value = client

        repo = self._repo()
        repo.config = {"name": "config-owner/config-repo"}
        repo.save()

        fetch_pr_file_stats(self.organization, repo, "7")
        mock_get_client.assert_called_once_with(self.organization, "config-owner/config-repo")
        client.get_pull_request_files.assert_called_once_with("config-owner/config-repo", "7")
