from __future__ import annotations

from typing import Any
from unittest import mock

import pytest

from sentry.integrations.cursor_origin.client import CursorOriginSetupApiClient
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase


class RecordingClient(CursorOriginSetupApiClient):
    """Captures the request the client would make, without issuing it.

    Overriding `request` short-circuits below the path-rewriting layer, so the
    rewrite is exercised for real while nothing leaves the process (and no
    token is minted, since authorize_request never runs).
    """

    def __init__(self) -> None:
        super().__init__(installation_id="i_test")
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        self.calls.append((path, kwargs))
        return {}


class ContentsPathRewriteTest(TestCase):
    """The rewrite that lets Sentry's GitHub-shaped helpers work against Origin.

    Origin serves contents from `/contents?path=...`; the documented
    `/contents/{path}` form 404s. Detection, CODEOWNERS lookups and stacktrace
    linking all build the GitHub-shaped path, so the client rewrites it.
    """

    def setUp(self) -> None:
        super().setUp()
        self.api_client = RecordingClient()

    def test_rewrites_github_shaped_contents_path(self) -> None:
        self.api_client.get("/repos/sentry/nuget-trends/contents/README.md")
        path, kwargs = self.api_client.calls[-1]
        assert path == "/repos/sentry/nuget-trends/contents"
        assert kwargs["params"]["path"] == "README.md"

    def test_preserves_existing_params_when_rewriting(self) -> None:
        self.api_client.get(
            "/repos/sentry/nuget-trends/contents/src/App.cs", params={"ref": "main"}
        )
        _, kwargs = self.api_client.calls[-1]
        assert kwargs["params"] == {"ref": "main", "path": "src/App.cs"}

    def test_rewrites_nested_paths_whole(self) -> None:
        self.api_client.get("/repos/o/r/contents/a/b/c/d.py")
        path, kwargs = self.api_client.calls[-1]
        assert path == "/repos/o/r/contents"
        assert kwargs["params"]["path"] == "a/b/c/d.py"

    def test_leaves_other_paths_alone(self) -> None:
        for path in (
            "/repos/o/r/git/trees/main",
            "/installation/repos",
            "/repos/o/r/contents",
        ):
            self.api_client.get(path)
            assert self.api_client.calls[-1][0] == path


class RateLimitTrackingTest(TestCase):
    """repo_trees backs off on a low remaining budget, so this has to be real."""

    def test_seeds_with_documented_budget_before_any_request(self) -> None:
        # Reporting 0 here would read as "exhausted" and make callers back off
        # before we had made a single request.
        assert CursorOriginSetupApiClient(installation_id="i_test").get_remaining_api_requests()

    def test_captures_remaining_from_response_headers(self) -> None:
        client = CursorOriginSetupApiClient(installation_id="i_test")

        class FakeResponse:
            headers = {"x-ratelimit-remaining": "2847"}

        client.track_response_data(200, None, FakeResponse())  # type: ignore[arg-type]
        assert client.get_remaining_api_requests() == 2847

    def test_ignores_a_malformed_header(self) -> None:
        client = CursorOriginSetupApiClient(installation_id="i_test")
        before = client.get_remaining_api_requests()

        class FakeResponse:
            headers = {"x-ratelimit-remaining": "not-a-number"}

        client.track_response_data(200, None, FakeResponse())  # type: ignore[arg-type]
        assert client.get_remaining_api_requests() == before


class ClientCrashGuardTest(TestCase):
    """Regressions for the three client crashes reported on #122180.

    All three are shapes Origin really returns, reached through code paths written
    against GitHub's shapes.
    """

    def setUp(self) -> None:
        super().setUp()
        self.api_client = CursorOriginSetupApiClient(installation_id="i_test")

    def test_should_count_api_error_tolerates_a_non_dict_body(self) -> None:
        # ApiError.json is whatever json.loads returned. A bare string body used to
        # reach .get() and raise AttributeError (C36-WPK).
        error = ApiError('"something went wrong"')
        # ApiError.json is annotated dict[str, Any] | None but holds whatever
        # json.loads returned. That gap between annotation and runtime is the bug,
        # so the assertion has to step outside the annotation to state it.
        body: Any = error.json
        assert body == "something went wrong"
        assert self.api_client.should_count_api_error(error, {}) is True

    def test_should_count_api_error_still_reads_a_dict_message(self) -> None:
        # The guard must not stop expected conditions being discounted.
        error = ApiError('{"message": "Not Found"}')
        assert self.api_client.should_count_api_error(error, {}) is False

    def test_get_file_raises_api_error_for_a_directory(self) -> None:
        # Origin answers a directory path with {"type": "dir", ...} and no
        # "content". Callers handle ApiError but not KeyError (RNJ-6A9).
        repo = self.create_repo(project=self.project, name="sentry/nuget-trends")
        with mock.patch.object(
            self.api_client, "get_contents", return_value={"type": "dir", "entries": []}
        ):
            with pytest.raises(ApiError):
                self.api_client.get_file(repo, "src", ref=None)

    def test_get_repos_exposes_the_github_shaped_name(self) -> None:
        # link_all_repos reads repo["full_name"]; Origin returns fullName (5Z5-T9N).
        with mock.patch.object(
            self.api_client, "get_repositories", return_value=[{"id": 7, "fullName": "o/r"}]
        ):
            assert self.api_client.get_repos() == [{"id": 7, "fullName": "o/r", "full_name": "o/r"}]
