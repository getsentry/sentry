from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
import responses

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_API_BASE_URL, PAGE_SIZE
from sentry.integrations.cursor_origin.repository import (
    MAX_COMPARE_COMMITS_OPTION_KEY,
    CursorOriginRepositoryProvider,
)
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.plugins.base import bindings
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

INSTALLATION_ID = "i_01example"
REPO = "acme/rocket"
WEB = "https://cursor.com/codebase"

ORIGIN_REPO: dict[str, Any] = {
    "id": "r_01example",
    "name": "rocket",
    "fullName": REPO,
    "owner": {"slug": "acme", "id": "ns_01example"},
    "defaultBranch": "main",
}


@control_silo_test
class CursorOriginRepositoryProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            metadata={
                "access_token": "oit_stored",
                "expires_at": (datetime.now(UTC) + timedelta(minutes=14))
                .isoformat()
                .replace("+00:00", "Z"),
            },
            status=ObjectStatus.ACTIVE,
        )
        self.provider = CursorOriginRepositoryProvider("integrations:cursor_origin")

    @responses.activate
    def _repository_data(self, identifier: str = REPO) -> dict[str, Any]:
        responses.add(responses.GET, f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}", json=ORIGIN_REPO)
        config: dict[str, Any] = {"installation": self.integration.id, "identifier": identifier}
        return dict(self.provider.get_repository_data(self.organization, config))

    def test_registered_for_the_repository_picker(self) -> None:
        provider = bindings.get("integration-repository.provider").get("integrations:cursor_origin")

        assert provider is CursorOriginRepositoryProvider

    def test_reads_the_repository_from_origin(self) -> None:
        data = self._repository_data()

        assert data["external_id"] == "r_01example"
        assert data["name"] == REPO
        assert data["default_branch"] == "main"

    def test_carries_the_integration_id_to_the_config(self) -> None:
        """build_repository_config reads this, so leaving it out fails after the API calls."""
        assert self._repository_data()["integration_id"] == self.integration.id

    def test_the_config_is_built_from_what_the_picker_produced(self) -> None:
        config = self.provider.build_repository_config(self.organization, self._repository_data())

        assert config == {
            "name": REPO,
            "external_id": "r_01example",
            "url": f"{WEB}/{REPO}",
            "config": {"name": REPO, "default_branch": "main"},
            "integration_id": self.integration.id,
        }

    @responses.activate
    def test_an_unreadable_repository_is_an_integration_error(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/acme/nope",
            json={"code": 5, "message": "not found"},
            status=404,
        )
        config = {"installation": self.integration.id, "identifier": "acme/nope"}

        with pytest.raises(IntegrationError):
            self.provider.get_repository_data(self.organization, config)

    def test_the_external_slug_is_the_full_name(self) -> None:
        assert self.provider.repository_external_slug(Repository(name=REPO)) == REPO

    def test_pull_request_url(self) -> None:
        url = self.provider.pull_request_url(Repository(name=REPO), PullRequest(key="7"))

        assert url == f"{WEB}/{REPO}/pull/7"


class ReinstallTransferTest(TestCase):
    """No silo decorator: `Repository` is a region model and this writes one."""

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            status=ObjectStatus.ACTIVE,
        )
        self.provider = CursorOriginRepositoryProvider("integrations:cursor_origin")

    def test_a_reinstall_adopts_the_old_installation_s_repository(self) -> None:
        """Origin issues a new installation id, and a repository is unique per org."""
        stranded_integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id="i_01previous",
            status=ObjectStatus.DISABLED,
        )
        stranded = Repository.objects.create(
            organization_id=self.organization.id,
            name=REPO,
            provider="integrations:cursor_origin",
            integration_id=stranded_integration.id,
            external_id=ORIGIN_REPO["id"],
            status=ObjectStatus.DISABLED,
        )

        _, repo = self.provider.create_repository(
            {
                "installation": self.integration.id,
                "identifier": REPO,
                "external_id": ORIGIN_REPO["id"],
                "name": REPO,
                "default_branch": "main",
                "integration_id": self.integration.id,
            },
            serialize_rpc_organization(self.organization),
        )

        assert repo.id == stranded.id
        assert Repository.objects.count() == 1
        stranded.refresh_from_db()
        assert stranded.integration_id == self.integration.id
        assert stranded.status == ObjectStatus.ACTIVE


def _commit(sha: str, message: str = "a change", email: str = "dev@example.com") -> dict[str, Any]:
    return {
        "sha": sha,
        "commit": {
            "author": {"name": "A Dev", "email": email, "date": "2026-09-16T12:00:00Z"},
            "committer": {"name": "A Dev", "email": email, "date": "2026-09-16T12:00:00Z"},
            "message": message,
        },
        "parents": [],
    }


def _file(filename: str, status: str, previous: str | None = None) -> dict[str, Any]:
    file: dict[str, Any] = {
        "filename": filename,
        "status": status,
        "additions": 1,
        "deletions": 0,
        "changes": 1,
        "patch": "",
    }
    if previous is not None:
        file["previousFilename"] = previous
    return file


@control_silo_test
class CompareCommitsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            metadata={
                "access_token": "oit_stored",
                "expires_at": (datetime.now(UTC) + timedelta(minutes=14))
                .isoformat()
                .replace("+00:00", "Z"),
            },
            status=ObjectStatus.ACTIVE,
        )
        self.provider = CursorOriginRepositoryProvider("integrations:cursor_origin")
        self.repo = Repository(
            organization_id=self.organization.id,
            name=REPO,
            provider="integrations:cursor_origin",
            integration_id=self.integration.id,
            external_id="r_01example",
            config={"name": REPO, "default_branch": "main"},
        )

    def _stub_compare(self, ahead_by: int, status_name: str = "ahead") -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/compare/a...b",
            json={"status": status_name, "aheadBy": ahead_by, "behindBy": 0},
        )

    def _stub_commits(self, *commits: dict[str, Any], sha: str = "b") -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/commits",
            json={"commits": list(commits), "nextPageToken": ""},
        )

    def _stub_files(self, sha: str, *files: dict[str, Any]) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/commits/{sha}/files",
            json={"files": list(files), "nextPageToken": ""},
        )

    def _query(self, index: int) -> dict[str, list[str]]:
        return parse_qs(urlparse(responses.calls[index].request.url).query)

    @responses.activate
    def test_a_first_release_reports_recent_commits(self) -> None:
        """With no previous release there is nothing to compare against."""
        self._stub_commits(_commit("b"), _commit("a"))
        self._stub_files("b")
        self._stub_files("a")

        commits = self.provider.compare_commits(self.repo, None, "b")

        assert [c["id"] for c in commits] == ["a", "b"]
        # Recent commits are read from the head, with no comparison call.
        assert self._query(0) == {"sha": ["b"], "pageSize": ["20"]}
        assert "/compare/" not in "".join(call.request.url for call in responses.calls)

    @responses.activate
    def test_a_range_walks_back_as_far_as_the_comparison_counts(self) -> None:
        self._stub_compare(ahead_by=2)
        self._stub_commits(_commit("c"), _commit("b"))
        self._stub_files("c")
        self._stub_files("b")

        commits = self.provider.compare_commits(self.repo, "a", "b")

        assert [c["id"] for c in commits] == ["b", "c"]
        assert self._query(1) == {"sha": ["b"], "pageSize": ["2"]}

    @responses.activate
    def test_an_unchanged_range_reads_no_commits(self) -> None:
        self._stub_compare(ahead_by=0, status_name="identical")

        assert self.provider.compare_commits(self.repo, "a", "b") == []

        assert len(responses.calls) == 1

    @responses.activate
    def test_a_long_range_is_capped(self) -> None:
        """Each commit's file list costs 5 points of an installation's 3,000 per minute."""
        self._stub_compare(ahead_by=900)
        # A page is PAGE_SIZE at most however large the range is, so the cap can only be
        # seen in where the walk stops.
        for token in ("page-2", ""):
            responses.add(
                responses.GET,
                f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/commits",
                json={
                    "commits": [_commit(f"{token}-{i}") for i in range(PAGE_SIZE)],
                    "nextPageToken": token,
                },
            )
        responses.add(
            responses.GET,
            re.compile(rf"{re.escape(CURSOR_ORIGIN_API_BASE_URL)}/repos/.+/commits/.+/files"),
            json={"files": [], "nextPageToken": ""},
        )

        with self.options({MAX_COMPARE_COMMITS_OPTION_KEY: 150}):
            commits = self.provider.compare_commits(self.repo, "a", "b")

        assert len(commits) == 150
        commit_reads = [
            call for call in responses.calls if call.request.url.split("?")[0].endswith("/commits")
        ]
        assert len(commit_reads) == 2
        assert parse_qs(urlparse(commit_reads[0].request.url).query)["pageSize"] == [str(PAGE_SIZE)]

    @responses.activate
    def test_the_patch_set_carries_every_kind_of_change(self) -> None:
        self._stub_compare(ahead_by=1)
        self._stub_commits(_commit("b"))
        self._stub_files(
            "b",
            _file("src/edited.py", "modified"),
            _file("src/added.py", "added"),
            _file("src/gone.py", "removed"),
            _file("src/new_name.py", "renamed", previous="src/old_name.py"),
            _file("src/copy.py", "copied"),
        )

        commits = self.provider.compare_commits(self.repo, "a", "b")

        assert commits[0]["patch_set"] == [
            {"path": "src/edited.py", "type": "M"},
            {"path": "src/added.py", "type": "A"},
            {"path": "src/gone.py", "type": "D"},
            {"path": "src/old_name.py", "type": "D"},
            {"path": "src/new_name.py", "type": "A"},
            {"path": "src/copy.py", "type": "A"},
        ]

    @responses.activate
    def test_a_commit_carries_the_author_and_message(self) -> None:
        self._stub_compare(ahead_by=1)
        self._stub_commits(_commit("b", message="fix: a thing"))
        self._stub_files("b")

        commit = self.provider.compare_commits(self.repo, "a", "b")[0]

        assert commit["id"] == "b"
        assert commit["repository"] == REPO
        assert commit["author_email"] == "dev@example.com"
        assert commit["author_name"] == "A Dev"
        assert commit["message"] == "fix: a thing"
        assert commit["timestamp"].isoformat() == "2026-09-16T12:00:00+00:00"

    @responses.activate
    def test_a_long_author_name_is_truncated_to_the_column(self) -> None:
        """`set_commits` truncates the email but not the name, and the column stops at 128."""
        long_name = "A" * 200
        commit = _commit("b")
        commit["commit"]["author"]["name"] = long_name
        self._stub_compare(ahead_by=1)
        self._stub_commits(commit)
        self._stub_files("b")

        assert self.provider.compare_commits(self.repo, "a", "b")[0]["author_name"] == "A" * 128

    @responses.activate
    def test_a_failure_is_raised_as_an_integration_error(self) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/compare/a...b",
            json={"code": 5, "message": "not found"},
            status=404,
        )

        with pytest.raises(IntegrationError):
            self.provider.compare_commits(self.repo, "a", "b")
