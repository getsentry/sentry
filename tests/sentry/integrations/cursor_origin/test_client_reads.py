from __future__ import annotations

from base64 import b64encode
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest import mock
from urllib.parse import parse_qs, urlparse

import pytest
import responses

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.client import CursorOriginApiClient
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_API_BASE_URL
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import (
    ApiConflictError,
    ApiError,
    ApiForbiddenError,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

INSTALLATION_ID = "i_01example"
REPO = "acme/rocket"


def _iso(offset: timedelta) -> str:
    return (datetime.now(UTC) + offset).isoformat().replace("+00:00", "Z")


def blob(path: str, size: int = 100) -> dict[str, Any]:
    return {"path": path, "mode": "100644", "type": "blob", "sha": "abc", "size": size}


@control_silo_test
class CursorOriginReadsTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            metadata={"access_token": "oit_stored", "expires_at": _iso(timedelta(minutes=14))},
            status=ObjectStatus.ACTIVE,
        )
        self.origin_client = CursorOriginApiClient(integration=self.integration)

    @responses.activate
    def test_get_repositories_paginates(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/installation/repos",
            json={
                "repositories": [{"id": "1", "fullName": REPO, "name": "rocket"}],
                "nextPageToken": "",
            },
        )

        repos = self.origin_client.get_repositories()

        assert [repo["fullName"] for repo in repos] == [REPO]
        assert "filter" not in parse_qs(urlparse(responses.calls[0].request.url).query)

    @responses.activate
    def test_a_query_is_sent_as_origin_s_filter(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/installation/repos",
            json={
                "repositories": [{"id": "1", "fullName": REPO, "name": "rocket"}],
                "nextPageToken": "",
            },
        )

        self.origin_client.get_repositories("acme/rock")

        query = parse_qs(urlparse(responses.calls[0].request.url).query)
        assert query["filter"] == ["acme/rock"]

    @responses.activate
    def test_get_repo(self) -> None:
        responses.add(
            responses.GET, f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}", json={"fullName": REPO}
        )

        assert self.origin_client.get_repo(REPO)["fullName"] == REPO

    @responses.activate
    def test_get_branches_reads_tip_commits(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/branches",
            json={
                "branches": [{"name": "main", "commit": {"sha": "abc"}}],
                "nextPageToken": "",
            },
        )

        branches = self.origin_client.get_branches(REPO)

        assert [(branch["name"], branch["commit"]["sha"]) for branch in branches] == [
            ("main", "abc")
        ]

    @responses.activate
    def test_get_tree_requests_a_recursive_walk(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/git/trees/HEAD",
            json={"tree": [blob("a.py")], "truncated": False},
        )

        entries = self.origin_client.get_tree(REPO, "HEAD")

        assert entries == [blob("a.py")]
        assert "recursive=true" in responses.calls[0].request.url

    @responses.activate
    def test_get_tree_response_reports_truncation(self) -> None:
        """Origin caps recursive walks at 100k entries / 7 MiB."""
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/git/trees/HEAD",
            json={"tree": [blob("a.py")], "truncated": True},
        )

        entries, truncated = self.origin_client.get_tree_response(REPO, "HEAD")

        assert entries == [blob("a.py")]
        assert truncated is True

    @responses.activate
    def test_an_empty_repository_raises_api_conflict(self) -> None:
        """Origin answers 409 for an empty repo; detection already handles ApiConflictError."""
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/git/trees/HEAD",
            json={"code": 10, "message": "empty repository"},
            status=409,
        )

        with pytest.raises(ApiConflictError):
            self.origin_client.get_tree(REPO, "HEAD")

    def test_get_languages_uses_a_tree_it_is_given(self) -> None:
        """Detection already holds the tree, so passing it avoids a second fetch."""
        with mock.patch.object(self.origin_client, "get_tree") as mock_tree:
            languages = self.origin_client.get_languages(REPO, [blob("a.py", 300)])

        assert languages == {"Python": 300}
        assert not mock_tree.called

    def test_get_languages_fetches_the_tree_when_not_given_one(self) -> None:
        with mock.patch.object(
            self.origin_client, "get_tree", return_value=[blob("a.py", 42)]
        ) as mock_tree:
            languages = self.origin_client.get_languages(REPO)

        assert languages == {"Python": 42}
        assert mock_tree.called

    @responses.activate
    def test_get_commits_starts_from_a_ref(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/commits",
            json={"commits": [{"sha": "abc"}], "nextPageToken": ""},
        )

        commits = self.origin_client.get_commits(REPO, sha="main")

        assert [commit["sha"] for commit in commits] == ["abc"]
        assert "sha=main" in responses.calls[0].request.url

    @responses.activate
    def test_get_commits_defaults_to_the_default_branch(self) -> None:
        """Origin reads an absent `sha` as the repository's default branch."""
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/commits",
            json={"commits": [], "nextPageToken": ""},
        )

        self.origin_client.get_commits(REPO)

        assert "sha=" not in responses.calls[0].request.url

    @responses.activate
    def test_paging_repeats_the_parameters_the_token_was_made_with(self) -> None:
        """Commit files reject a token whose `sha` and `pageSize` do not match it."""
        url = f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/commits/abc/files"
        responses.add(
            responses.GET, url, json={"files": [{"filename": "a.py"}], "nextPageToken": "page-2"}
        )
        responses.add(
            responses.GET, url, json={"files": [{"filename": "b.py"}], "nextPageToken": ""}
        )

        files = self.origin_client.get_commit_files(REPO, "abc")

        assert [f["filename"] for f in files] == ["a.py", "b.py"]
        second_request = responses.calls[1].request.url
        assert "pageToken=page-2" in second_request
        assert "sha=abc" in second_request
        assert "pageSize=100" in second_request

    @responses.activate
    def test_get_commit_reads_one_commit(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/commits/abc",
            json={"sha": "abc", "stats": {"total": 2}},
        )

        assert self.origin_client.get_commit(REPO, "abc")["stats"] == {"total": 2}

    @responses.activate
    def test_compare_commits_reads_the_summary(self) -> None:
        """Origin embeds neither the commits nor the files in a comparison."""
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/compare/abc...def",
            json={"status": "ahead", "aheadBy": 2, "behindBy": 0},
        )

        comparison = self.origin_client.compare_commits(REPO, "abc", "def")

        assert comparison["status"] == "ahead"
        assert comparison["aheadBy"] == 2

    @responses.activate
    def test_get_compare_files_reads_what_differs(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/compare/abc...def/files",
            json={"files": [{"filename": "a.py", "status": "modified"}], "nextPageToken": ""},
        )

        files = self.origin_client.get_compare_files(REPO, "abc", "def")

        assert [(f["filename"], f["status"]) for f in files] == [("a.py", "modified")]

    @responses.activate
    def test_get_contents_passes_the_path_as_a_query_parameter(self) -> None:
        """Origin serves contents from ?path=; the path form 404s misleadingly."""
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/contents",
            json={"type": "file", "content": ""},
        )

        self.origin_client.get_contents(REPO, "src/app.py")

        request_url = responses.calls[0].request.url
        assert "/contents?" in request_url
        assert "path=src%2Fapp.py" in request_url

    @responses.activate
    def test_get_contents_on_a_directory_lists_its_children(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/contents",
            json={
                "type": "dir",
                "name": "src",
                "path": "src",
                "sha": "def",
                "encoding": "",
                "size": "0",
                "entries": [
                    {
                        "type": "file",
                        "name": "app.py",
                        "path": "src/app.py",
                        "sha": "abc",
                        "size": "312",
                    }
                ],
            },
        )

        contents = self.origin_client.get_contents(REPO, "src")

        assert contents["type"] == "dir"
        assert [entry["path"] for entry in contents["entries"]] == ["src/app.py"]

    @responses.activate
    def test_get_blob_reads_base64_content(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/git/blobs/abc",
            json={
                "sha": "abc",
                "size": 2,
                "encoding": "base64",
                "content": b64encode(b"hi").decode(),
            },
        )

        assert self.origin_client.get_blob(REPO, "abc")["content"] == b64encode(b"hi").decode()

    @responses.activate
    def test_get_file_decodes_base64(self) -> None:
        repo = Repository(name=REPO)
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/contents",
            json={"type": "file", "encoding": "base64", "content": b64encode(b"hi").decode()},
        )

        assert self.origin_client.get_file(repo, "a.py", ref=None) == "hi"

    @responses.activate
    def test_get_file_on_a_directory_raises_api_error(self) -> None:
        """A directory has entries and no content; callers handle ApiError, not KeyError."""
        repo = Repository(name=REPO)
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/contents",
            json={"type": "dir", "entries": []},
        )

        with pytest.raises(ApiError):
            self.origin_client.get_file(repo, "src", ref=None)

    @responses.activate
    def test_check_file_raises_when_missing(self) -> None:
        """RepositoryIntegration.check_file is what turns a 404 into None."""
        repo = Repository(name=REPO)
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/contents",
            json={"code": 5, "message": "resource not found"},
            status=404,
        )

        with pytest.raises(ApiError) as exc:
            self.origin_client.check_file(repo, "nope.py", None)

        assert exc.value.code == 404

    @responses.activate
    def test_check_file_does_not_hide_a_forbidden_file(self) -> None:
        """A swallowed 403 is indistinguishable from a file that is not there."""
        repo = Repository(name=REPO)
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/contents",
            json={"code": 7, "message": "permission denied"},
            status=403,
        )

        with pytest.raises(ApiForbiddenError):
            self.origin_client.check_file(repo, "secret.py", None)

    @responses.activate
    def test_rate_limit_header_is_captured(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}",
            json={"fullName": REPO},
            headers={"x-ratelimit-remaining": "42"},
        )

        self.origin_client.get_repo(REPO)

        assert self.origin_client.get_remaining_api_requests() == 42

    def test_remaining_requests_defaults_to_the_documented_budget(self) -> None:
        """Reporting 0 before any request would make repo_trees back off immediately."""
        assert self.origin_client.get_remaining_api_requests() == 3000

    def test_expected_conditions_do_not_count_as_connection_errors(self) -> None:
        for code in (403, 404, 409):
            assert self.origin_client.should_count_api_error(ApiError("x", code=code), {}) is False

    def test_unexpected_errors_count(self) -> None:
        assert self.origin_client.should_count_api_error(ApiError("x", code=500), {}) is True
