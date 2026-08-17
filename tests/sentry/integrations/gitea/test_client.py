from typing import Any
from unittest import mock

import pytest
import responses

from sentry.auth.exceptions import IdentityNotValid
from sentry.integrations.gitea.client import GiteaApiClient
from sentry.integrations.gitea.integration import GiteaIntegration
from sentry.integrations.gitea.utils import get_rate_limit_info_from_response, quote_path
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiPaginationTruncated,
    ApiUnauthorized,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity

GITEA_URL = "https://gitea.example.com"
API_URL = f"{GITEA_URL}/api/v1"


@control_silo_test
class GiteaApiClientTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_provider_integration(
            provider=IntegrationProviderSlug.GITEA.value,
            name="gitea.example.com",
            external_id="gitea.example.com:client-id",
            metadata={
                "instance": "gitea.example.com",
                "domain_name": "gitea.example.com",
                "base_url": GITEA_URL,
                "verify_ssl": True,
                "webhook_secret": "hook-secret",
                "scopes": ["read:repository", "read:user", "write:issue", "write:repository"],
                "instance_version": "1.27.1",
            },
        )
        identity = self.create_identity(
            user=self.user,
            identity_provider=self.create_identity_provider(
                type=IntegrationProviderSlug.GITEA.value
            ),
            external_id="gitea.example.com:42",
            data={
                "access_token": "access-token",
                "refresh_token": "refresh-token",
                "expires": 1234567890,
                "client_id": "client-id",
                "client_secret": "client-secret",
            },
        )
        self.integration.add_organization(self.organization, self.user, identity.id)
        installation = self.integration.get_installation(self.organization.id)
        assert isinstance(installation, GiteaIntegration)
        self.installation = installation
        self.gitea_client = self.installation.get_client()

        self.repo = Repository(
            name="acme/widgets",
            provider="integrations:gitea",
            organization_id=self.organization.id,
            config={"path": "acme/widgets", "project_id": 7},
        )

    def tearDown(self) -> None:
        responses.reset()
        super().tearDown()

    def _add(self, method: str, path: str, **kwargs: Any) -> None:
        responses.add(method, f"{API_URL}{path}", **kwargs)

    @responses.activate
    def test_builds_urls_from_the_stored_base_url(self) -> None:
        self._add(responses.GET, "/repos/acme/widgets", json={"default_branch": "main"})

        assert self.gitea_client.get_default_branch("acme/widgets") == "main"
        assert responses.calls[0].request.url == f"{API_URL}/repos/acme/widgets"
        assert responses.calls[0].request.headers["Authorization"] == "Bearer access-token"

    @responses.activate
    def test_builds_urls_for_sub_path_installs(self) -> None:
        self.integration.metadata["base_url"] = f"{GITEA_URL}/gitea"
        self.integration.save()
        client = self.integration.get_installation(self.organization.id).get_client()

        responses.add(
            responses.GET,
            f"{GITEA_URL}/gitea/api/v1/repos/acme/widgets",
            json={"default_branch": "main"},
        )

        assert client.get_default_branch("acme/widgets") == "main"

    @responses.activate
    def test_search_repos_unwraps_and_paginates(self) -> None:
        page_one = [
            {"id": i, "full_name": f"acme/repo-{i}"} for i in range(self.gitea_client.page_size)
        ]
        self._add(responses.GET, "/repos/search", json={"ok": True, "data": page_one})
        self._add(
            responses.GET,
            "/repos/search",
            json={"ok": True, "data": [{"id": 999, "full_name": "acme/last"}]},
        )

        results = self.gitea_client.search_repos(query="acme")

        assert len(results) == self.gitea_client.page_size + 1
        assert results[-1]["full_name"] == "acme/last"
        # Gitea pages from 1 and names the page size `limit`.
        assert "page=1" in responses.calls[0].request.url
        assert f"limit={self.gitea_client.page_size}" in responses.calls[0].request.url
        assert "page=2" in responses.calls[1].request.url
        # No `uid` was asked for, so none is sent.
        assert "uid" not in responses.calls[0].request.url

    @responses.activate
    def test_search_repos_scopes_to_a_user_when_given_a_uid(self) -> None:
        self._add(responses.GET, "/repos/search", json={"ok": True, "data": []})

        self.gitea_client.search_repos(query="acme", uid=42)

        assert "uid=42" in responses.calls[0].request.url

    @responses.activate
    def test_search_repos_raises_when_every_allowed_page_came_back_full(self) -> None:
        # A short page is how the pagination helper knows it reached the end,
        # so filling every page it is allowed to fetch is the one shape that
        # means the cap stopped us rather than the data running out.
        full_page = [
            {"id": i, "full_name": f"acme/repo-{i}"} for i in range(self.gitea_client.page_size)
        ]
        for _ in range(self.gitea_client.page_number_limit):
            self._add(responses.GET, "/repos/search", json={"ok": True, "data": full_page})

        with pytest.raises(ApiPaginationTruncated) as excinfo:
            self.gitea_client.search_repos(raise_on_page_limit=True)

        assert (
            len(excinfo.value.partial_data)
            == self.gitea_client.page_size * self.gitea_client.page_number_limit
        )

    @responses.activate
    def test_search_repos_does_not_raise_when_the_cap_was_not_reached(self) -> None:
        self._add(responses.GET, "/repos/search", json={"ok": True, "data": [{"id": 1}]})

        assert self.gitea_client.search_repos(raise_on_page_limit=True) == [{"id": 1}]

    @responses.activate
    def test_get_commits_filters_by_path(self) -> None:
        # Gitea has no REST blame endpoint, so suspect commits lean on the
        # commit list filtered by file path.
        self._add(responses.GET, "/repos/acme/widgets/commits", json=[{"sha": "abc"}])

        self.gitea_client.get_commits("acme/widgets", sha="main", path="src/app.py")

        url = responses.calls[0].request.url
        assert "sha=main" in url
        assert "path=src%2Fapp.py" in url

    @responses.activate
    def test_compare_commits_uses_the_basehead_route(self) -> None:
        self._add(responses.GET, "/repos/acme/widgets/compare/aaa...bbb", json={"commits": []})

        self.gitea_client.compare_commits("acme/widgets", "aaa", "bbb")

        assert responses.calls[0].request.url.endswith("/compare/aaa...bbb")

    @responses.activate
    def test_check_file(self) -> None:
        self._add(
            responses.GET,
            "/repos/acme/widgets/contents/src/app.py",
            json={"name": "app.py"},
        )

        assert self.gitea_client.check_file(self.repo, "src/app.py", "main") is not None
        # Path separators stay real path segments rather than being encoded.
        assert "/contents/src/app.py?ref=main" in responses.calls[0].request.url

    @responses.activate
    def test_check_file_missing(self) -> None:
        self._add(responses.GET, "/repos/acme/widgets/contents/nope.py", status=404)

        with pytest.raises(ApiError):
            self.gitea_client.check_file(self.repo, "nope.py", "main")

    @responses.activate
    def test_get_file_reads_the_raw_route(self) -> None:
        self._add(responses.GET, "/repos/acme/widgets/raw/src/app.py", body="print('hi')\n")

        assert self.gitea_client.get_file(self.repo, "src/app.py", "main") == "print('hi')\n"
        assert "/raw/src/app.py?ref=main" in responses.calls[0].request.url

    @responses.activate
    def test_create_repo_webhook_uses_the_composite_secret(self) -> None:
        self._add(responses.POST, "/repos/acme/widgets/hooks", json={"id": 12})

        hook_id = self.gitea_client.create_repo_webhook(
            "acme/widgets", "https://sentry.io/extensions/gitea/organizations/1/webhook/2/"
        )

        assert hook_id == 12
        body = responses.calls[0].request.body
        # Binds both route components into the HMAC key, so a body signed for
        # one organization cannot be replayed at another's webhook endpoint -
        # organizations sharing an OAuth app share the stored secret.
        expected = f'"secret": "{self.organization.id}:{self.integration.id}:hook-secret"'
        assert expected.encode() in body
        assert b'"events": ["push", "pull_request"]' in body

    @responses.activate
    def test_request_accepts_and_drops_credentials_set(self) -> None:
        # Keeps the client shaped like `scm.types.ApiClient` so the future
        # scm-platform provider is a drop-in.
        self._add(responses.GET, "/repos/acme/widgets", json={"default_branch": "main"})

        response = self.gitea_client.request(
            "GET", "/repos/acme/widgets", credentials_set="installation"
        )

        assert response["default_branch"] == "main"
        assert "credentials_set" not in (responses.calls[0].request.url or "")

    def _stub_token_refresh(self) -> None:
        responses.add(
            responses.POST,
            f"{GITEA_URL}/login/oauth/access_token",
            json={
                "access_token": "fresh-access-token",
                "refresh_token": "fresh-refresh-token",
                "expires_in": 3600,
                "token_type": "bearer",
            },
        )

    @responses.activate
    def test_refreshes_the_token_on_401_and_retries_with_the_new_one(self) -> None:
        # Gitea access tokens expire in ~1h, so this is the common path rather
        # than a rare one. The retry has to carry the *refreshed* token - the
        # provider mutates `identity.data` in place on the cached identity, and
        # a regression there looks like an integration that works for an hour
        # and then never again.
        self._add(responses.GET, "/repos/acme/widgets", status=401)
        self._add(responses.GET, "/repos/acme/widgets", json={"default_branch": "main"})
        self._stub_token_refresh()

        assert self.gitea_client.get_default_branch("acme/widgets") == "main"

        sent = [call.request for call in responses.calls]
        assert sent[0].headers["Authorization"] == "Bearer access-token"
        assert sent[1].url == f"{GITEA_URL}/login/oauth/access_token"
        assert sent[2].headers["Authorization"] == "Bearer fresh-access-token"

    @responses.activate
    def test_refresh_persists_the_rotated_tokens(self) -> None:
        # Gitea rotates the refresh token on use, so dropping the new one
        # breaks the *next* refresh rather than this one.
        self._add(responses.GET, "/repos/acme/widgets", status=401)
        self._add(responses.GET, "/repos/acme/widgets", json={"default_branch": "main"})
        self._stub_token_refresh()

        self.gitea_client.get_default_branch("acme/widgets")

        stored = Identity.objects.get(external_id="gitea.example.com:42")
        assert stored.data["access_token"] == "fresh-access-token"
        assert stored.data["refresh_token"] == "fresh-refresh-token"
        # The credentials the next refresh needs must survive the update.
        assert stored.data["client_id"] == "client-id"
        assert stored.data["client_secret"] == "client-secret"

    @responses.activate
    def test_unparseable_refresh_response_raises_identity_not_valid(self) -> None:
        # A proxy in front of the instance answering 200 with an HTML login
        # page used to escape as a bare KeyError.
        self._add(responses.GET, "/repos/acme/widgets", status=401)
        responses.add(
            responses.POST,
            f"{GITEA_URL}/login/oauth/access_token",
            body="<html>sign in</html>",
            content_type="text/html",
        )

        with pytest.raises(IdentityNotValid):
            self.gitea_client.get_default_branch("acme/widgets")

    @responses.activate
    def test_refresh_url_is_the_instance_token_endpoint(self) -> None:
        self._add(responses.GET, "/repos/acme/widgets", status=401)
        self._add(responses.GET, "/repos/acme/widgets", json={"default_branch": "main"})

        with mock.patch(
            "sentry.identity.gitea.provider.GiteaIdentityProvider.refresh_identity"
        ) as mock_refresh:
            self.gitea_client.get_default_branch("acme/widgets")

        assert mock_refresh.call_args.kwargs["refresh_token_url"] == (
            f"{GITEA_URL}/login/oauth/access_token"
        )

    @responses.activate
    def test_gives_up_after_a_failed_refresh(self) -> None:
        self._add(responses.GET, "/repos/acme/widgets", status=401)
        self._add(responses.GET, "/repos/acme/widgets", status=401)

        with mock.patch.object(GiteaApiClient, "_refresh_auth", return_value=None):
            with pytest.raises(ApiUnauthorized):
                self.gitea_client.get_default_branch("acme/widgets")


class GiteaQuotePathTest(TestCase):
    def test_keeps_separators_as_real_path_segments(self) -> None:
        # Gitea routes file paths as segments, unlike GitLab's single encoded
        # component.
        assert quote_path("src/app.py") == "src/app.py"
        assert quote_path("src/a file.py") == "src/a%20file.py"
        assert quote_path("src/a?b.py") == "src/a%3Fb.py"

    def test_rejects_relative_segments(self) -> None:
        # `requests` resolves dot segments before sending, so these would climb
        # out of `/repos/{owner}/{repo}/contents/` and hit unrelated API routes.
        for path in ("../../../../user", "src/../../../user", "./src/app.py", ".."):
            with pytest.raises(ValueError):
                quote_path(path)

    def test_strips_leading_slashes(self) -> None:
        assert quote_path("/src/app.py") == "src/app.py"


class GiteaRateLimitInfoTest(TestCase):
    def test_parses_the_ietf_headers_when_present(self) -> None:
        response = mock.Mock()
        response.headers = {
            "RateLimit-Limit": "100",
            "RateLimit-Remaining": "0",
            "RateLimit-Reset": "1700000000",
        }

        info = get_rate_limit_info_from_response(response)

        assert info is not None
        assert info.limit == 100
        assert info.remaining == 0
        assert info.reset == 1700000000

    def test_absent_headers_are_not_an_error(self) -> None:
        # Stock Gitea does not rate limit at all.
        response = mock.Mock()
        response.headers = {}

        assert get_rate_limit_info_from_response(response) is None
