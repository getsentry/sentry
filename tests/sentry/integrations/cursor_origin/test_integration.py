from __future__ import annotations

from base64 import b64encode
from datetime import UTC, datetime, timedelta
from unittest import mock
from urllib.parse import parse_qs, urlparse

import pytest
import responses

from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidIdentity
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_API_BASE_URL
from sentry.integrations.cursor_origin.integration import (
    CursorOriginIntegration,
    CursorOriginIntegrationProvider,
)
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiPaginationTruncated,
    IntegrationError,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

INSTALLATION_ID = "i_01example"
REPO = "acme/rocket"
WEB = "https://cursor.com/codebase"
REPOS_URL = f"{CURSOR_ORIGIN_API_BASE_URL}/installation/repos"
JWT = "sentry.integrations.cursor_origin.client.get_jwt"
CONTENTS_URL = f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/contents"
INSTALL_URL = f"{CURSOR_ORIGIN_API_BASE_URL}/app/installations/{INSTALLATION_ID}"


def _iso(offset: timedelta) -> str:
    return (datetime.now(UTC) + offset).isoformat().replace("+00:00", "Z")


def _origin_repo(full_name: str = REPO, repo_id: str = "repo_1") -> dict[str, object]:
    return {"id": repo_id, "fullName": full_name, "name": "rocket", "defaultBranch": "main"}


@control_silo_test
class CursorOriginIntegrationTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            metadata={
                "access_token": "oit_stored",
                "expires_at": _iso(timedelta(minutes=14)),
                "domain_name": f"{WEB}/acme",
            },
            status=ObjectStatus.ACTIVE,
        )
        self.install = CursorOriginIntegration(self.integration, self.organization.id)

    def _repo(self, name: str = REPO, default_branch: str = "main") -> Repository:
        return Repository(
            organization_id=self.organization.id,
            name=name,
            config={"default_branch": default_branch},
        )

    def _stub_repos(self, *repos: dict[str, object], page_token: str = "") -> None:
        responses.add(
            responses.GET,
            REPOS_URL,
            json={"repositories": list(repos), "nextPageToken": page_token},
        )

    @responses.activate
    def test_get_repositories_maps_to_the_shared_shape(self) -> None:
        self._stub_repos(_origin_repo())

        repos = self.install.get_repositories()

        assert repos == [
            {
                "name": REPO,
                "identifier": REPO,
                "external_id": "repo_1",
                "default_branch": "main",
            }
        ]

    @responses.activate
    def test_a_query_is_left_to_origin(self) -> None:
        """Origin filters on names and owner namespaces, so searching is server-side."""
        self._stub_repos(_origin_repo("acme/widget"))

        assert [r["name"] for r in self.install.get_repositories(query="WIDG")] == ["acme/widget"]

        assert parse_qs(urlparse(responses.calls[0].request.url).query)["filter"] == ["WIDG"]
        assert self.install.repo_search is True

    @responses.activate
    def test_a_failed_listing_raises_rather_than_looking_empty(self) -> None:
        """The sync reads a missing repository as one the provider dropped."""
        responses.add(responses.GET, REPOS_URL, json={"code": 13, "message": "boom"}, status=500)

        with pytest.raises(IntegrationError):
            self.install.get_repositories()

    @responses.activate
    def test_truncation_raises_only_when_the_caller_opts_in(self) -> None:
        """Every page names a next one, so the client stops at its page limit."""
        self._stub_repos(_origin_repo(), page_token="more")

        assert len(self.install.get_repositories()) == 100
        with pytest.raises(ApiPaginationTruncated) as excinfo:
            self.install.get_repositories(raise_on_page_limit=True)

        # Callers read partial_data as RepositoryInfo, not as raw Origin dicts.
        assert excinfo.value.partial_data[0] == {
            "name": REPO,
            "identifier": REPO,
            "external_id": "repo_1",
            "default_branch": "main",
        }

    def test_rate_limit_is_recognised(self) -> None:
        assert self.install.is_rate_limited_error(ApiError("slow down", code=429)) is True
        assert self.install.is_rate_limited_error(ApiError("nope", code=404)) is False

    def test_a_failed_token_exchange_is_terminal(self) -> None:
        """Origin stops minting tokens once uninstalled; every call then fails here."""
        url = f"/app/installations/{INSTALLATION_ID}/access_tokens"
        assert (
            self.install.is_broken_integration_error(ApiError("no", code=401, url=url))
            == "installation_suspended"
        )
        assert (
            self.install.is_broken_integration_error(ApiError("slow", code=429, url=url))
            == "rate_limited"
        )

    def test_a_token_401_survives_the_conversion_to_invalid_identity(self) -> None:
        """raise_error wraps it, and the base class only unwraps IntegrationError."""
        url = f"/app/installations/{INSTALLATION_ID}/access_tokens"
        converted = InvalidIdentity("no")
        converted.__context__ = ApiError("no", code=401, url=url)

        assert self.install.is_broken_integration_error(converted) == "installation_suspended"

    def test_a_failed_resource_read_is_not_terminal(self) -> None:
        assert (
            self.install.is_broken_integration_error(ApiError("no", code=404, url=f"/repos/{REPO}"))
            is None
        )

    # -- stack-trace linking ----------------------------------------------

    def test_format_source_url(self) -> None:
        url = self.install.format_source_url(self._repo(), "src/app.py", "main")

        assert url == f"{WEB}/{REPO}/blob/main/src/app.py"

    def test_a_branch_containing_a_slash_is_one_encoded_segment(self) -> None:
        """Origin encodes the branch, so danf/x is unambiguous against the file path."""
        url = self.install.format_source_url(self._repo(), "AGENTS.md", "danf/test-branch")

        assert url == f"{WEB}/{REPO}/blob/danf%2Ftest-branch/AGENTS.md"

    def test_the_stacktrace_link_keeps_the_encoded_branch(self) -> None:
        repo = self._repo()
        source_url = self.install.format_source_url(repo, "src/app.py", "release/test")

        with mock.patch.object(self.install, "check_file", return_value=source_url):
            link = self.install.get_stacktrace_link(repo, "src/app.py", "main", "release/test")

        assert link == f"{WEB}/{REPO}/blob/release%2Ftest/src/app.py"

    def test_the_slashed_branch_round_trips(self) -> None:
        repo = self._repo()
        url = self.install.format_source_url(repo, "src/deep/app.py", "danf/test-branch")

        assert self.install.extract_branch_from_source_url(repo, url) == "danf/test-branch"
        assert self.install.extract_source_path_from_source_url(repo, url) == "src/deep/app.py"

    def test_a_repo_name_needing_encoding_round_trips(self) -> None:
        """Nothing re-encodes the URL after us, so the name is encoded on both sides."""
        repo = self._repo(name="acme/my repo")
        url = self.install.format_source_url(repo, "src/app.py", "release/test")

        assert url == f"{WEB}/acme/my%20repo/blob/release%2Ftest/src/app.py"
        assert self.install.extract_branch_from_source_url(repo, url) == "release/test"
        assert self.install.extract_source_path_from_source_url(repo, url) == "src/app.py"

    def test_a_decoded_url_still_extracts(self) -> None:
        """`project_repo_path_parsing` unquotes the path before extraction."""
        repo = self._repo(name="acme/my repo")

        assert (
            self.install.extract_source_path_from_source_url(
                repo, f"{WEB}/acme/my repo/blob/main/src/app.py"
            )
            == "src/app.py"
        )

    def test_a_path_needing_encoding_round_trips(self) -> None:
        repo = self._repo()
        url = self.install.format_source_url(repo, "src/my file.py", "main")

        assert self.install.extract_source_path_from_source_url(repo, url) == "src/my file.py"

    def test_falls_back_to_the_repo_default_branch(self) -> None:
        url = self.install.format_source_url(self._repo(default_branch="trunk"), "a.py", None)

        assert url == f"{WEB}/{REPO}/blob/trunk/a.py"

    def test_a_line_anchor_is_not_part_of_the_path(self) -> None:
        """Origin file URLs carry #L5, which must not reach the code mapping."""
        repo = self._repo()
        url = f"{WEB}/{REPO}/blob/main/src/app.py#L5"

        assert self.install.extract_source_path_from_source_url(repo, url) == "src/app.py"
        assert self.install.extract_branch_from_source_url(repo, url) == "main"

    def test_a_decoded_slashed_branch_reads_as_its_first_segment(self) -> None:
        """The code mapping endpoint unquotes the path first, as GitHub also sees."""
        repo = self._repo()
        url = f"{WEB}/{REPO}/blob/danf/test-branch/AGENTS.md"

        assert self.install.extract_branch_from_source_url(repo, url) == "danf"

    def test_an_unrecognised_url_extracts_nothing(self) -> None:
        repo = self._repo()

        assert self.install.extract_branch_from_source_url(repo, "https://example.com/x") == ""
        assert self.install.extract_source_path_from_source_url(repo, "https://example.com/x") == ""

    def test_source_url_matches_this_installation_only(self) -> None:
        assert self.install.source_url_matches(f"{WEB}/acme/rocket/blob/main/a.py") is True
        assert self.install.source_url_matches(f"{WEB}/other-org/repo/blob/main/a.py") is False

    def test_a_longer_org_name_is_not_a_match(self) -> None:
        """An install on "acme" must not claim URLs owned by "acme-corp"."""
        assert self.install.source_url_matches(f"{WEB}/acme-corp/repo/blob/main/a.py") is False

    def test_the_provider_advertises_codeowners_import(self) -> None:
        """Sentry only offers the import when the frozenset and the metadata both list it."""
        provider = CursorOriginIntegrationProvider()
        assert IntegrationFeatures.CODEOWNERS in provider.features
        assert IntegrationFeatures.CODEOWNERS in {
            feature.featureGate for feature in provider.metadata.features
        }

    @responses.activate
    def test_get_codeowner_file_walks_past_the_root_location(self) -> None:
        """Origin has no HEAD route, so check_file and get_file are both contents reads."""
        repo = self._repo()
        raw = "docs/*  @acme/eng\n* @acme/rocket\n"
        contents = {
            "type": "file",
            "encoding": "base64",
            "content": b64encode(raw.encode()).decode(),
        }

        responses.add(responses.GET, CONTENTS_URL, json={"message": "not found"}, status=404)
        responses.add(responses.GET, CONTENTS_URL, json=contents)
        responses.add(responses.GET, CONTENTS_URL, json=contents)

        result = self.install.get_codeowner_file(repo, ref="main")

        assert result == {
            "filepath": ".github/CODEOWNERS",
            "html_url": f"{WEB}/{REPO}/blob/main/.github/CODEOWNERS",
            "raw": raw,
        }
        assert [
            parse_qs(urlparse(call.request.url).query)["path"][0] for call in responses.calls
        ] == [
            "CODEOWNERS",
            ".github/CODEOWNERS",
            ".github/CODEOWNERS",
        ]

    @responses.activate
    def test_get_codeowner_file_returns_nothing_when_no_location_has_one(self) -> None:
        responses.add(responses.GET, CONTENTS_URL, json={"message": "not found"}, status=404)

        assert self.install.get_codeowner_file(self._repo(), ref="main") is None

    @responses.activate
    @mock.patch(JWT, return_value="jwt")
    def test_uninstall_removes_the_origin_installation(self, _jwt: mock.MagicMock) -> None:
        responses.add(responses.DELETE, INSTALL_URL, status=204)

        self.install.uninstall()

        assert [call.request.url for call in responses.calls] == [INSTALL_URL]

    @responses.activate
    @mock.patch(JWT, return_value="jwt")
    def test_uninstall_leaves_an_installation_another_organization_still_uses(
        self, _jwt: mock.MagicMock
    ) -> None:
        """One Origin installation can serve several Sentry organizations."""
        other_org = self.create_organization()
        self.create_organization_integration(
            organization_id=other_org.id, integration_id=self.integration.id
        )

        self.install.uninstall()

        assert len(responses.calls) == 0

    @responses.activate
    @mock.patch(JWT, return_value="jwt")
    def test_uninstall_accepts_an_installation_origin_has_already_dropped(
        self, _jwt: mock.MagicMock
    ) -> None:
        responses.add(responses.DELETE, INSTALL_URL, json={"message": "gone"}, status=404)

        self.install.uninstall()

    @responses.activate
    @mock.patch(JWT, side_effect=ValueError("cursor-origin-app.id is not configured"))
    def test_uninstall_is_not_blocked_by_an_unconfigured_app(self, _jwt: mock.MagicMock) -> None:
        """get_jwt raises before the request when the signing key is gone."""
        self.install.uninstall()

    @responses.activate
    @mock.patch(JWT, return_value="jwt")
    def test_uninstall_is_not_blocked_by_an_origin_failure(self, _jwt: mock.MagicMock) -> None:
        """Disconnecting from Sentry must not depend on Origin answering."""
        responses.add(responses.DELETE, INSTALL_URL, json={"message": "boom"}, status=500)

        self.install.uninstall()
