from __future__ import annotations

import base64
import time
from collections.abc import Sequence
from unittest import mock

import pytest
import responses
from django.conf import settings
from django.http import HttpResponseBase
from django.test import override_settings
from django.urls import resolve, reverse
from responses import matchers
from scm.errors import GitProviderNotSupported
from scm.git.grant import sign_grant
from scm.git.types import GRANT_HEADER, GitOperation, Grant
from scm.types import Repository as ScmRepository
from scm.types import RepositoryId
from sentry_sdk.data_collection import _apply_key_value_collection_filtering

from sentry.constants import ObjectStatus
from sentry.scm.endpoints.scm_git import get_git_token
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import cell_silo_test

SECRET = "a-long-value-that-is-hard-to-guess"
TOKEN = "ghs_installation_token"
FEATURE = "organizations:scm-git-endpoint"
# Far enough ahead that the GitHub client never refreshes the token over the network.
TOKEN_EXPIRES_AT = "3000-01-01T00:00:00"
REFS_URL = "https://github.com/getsentry/sentry.git/info/refs"


def sign(
    organization_id: int,
    operation: GitOperation,
    repositories: Sequence[RepositoryId],
    *,
    expires_in: int = 300,
    secret: str = SECRET,
) -> str:
    grant = Grant(
        organization_id=organization_id,
        operation=operation,
        repositories=tuple(repositories),
        expires_at=int(time.time()) + expires_in,
    )
    return sign_grant(secret, grant)


@cell_silo_test
@override_settings(SCM_GIT_GRANT_SECRETS=[SECRET])
@with_feature(FEATURE)
class ScmGitEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="1",
            metadata={"access_token": TOKEN, "expires_at": TOKEN_EXPIRES_AT},
        )
        self.repo = self.create_repo(
            self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id="12345",
        )

    def fetch_grant(self) -> str:
        return sign(self.organization.id, "fetch", [self.repo.id])

    def git(
        self,
        method: str,
        route: str,
        query: str,
        grant: str,
        repository_id: int | None = None,
        body: bytes = b"",
    ) -> HttpResponseBase:
        url = reverse(
            "sentry-api-0-scm-git",
            kwargs={"repository_id": repository_id or self.repo.id, "route": route},
        )
        return self.send(method, f"{url}?{query}", grant, body)

    def send(self, method: str, url: str, grant: str, body: bytes = b"") -> HttpResponseBase:
        return self.client.generic(
            method,
            url,
            data=body,
            content_type="application/x-git-request",
            headers={GRANT_HEADER: grant},
        )

    def assert_refused(self, response: HttpResponseBase, status: int, message: bytes) -> None:
        assert response.status_code == status
        assert response["Content-Type"] == "text/plain; charset=utf-8"
        assert message in b"".join(response)
        assert len(responses.calls) == 0

    @responses.activate
    def test_relays_a_fetch_with_the_installation_token(self) -> None:
        responses.add(
            responses.GET,
            REFS_URL,
            match=[matchers.query_string_matcher("service=git-upload-pack")],
            body=b"001e# service=git-upload-pack\n0000",
            content_type="application/x-git-upload-pack-advertisement",
        )

        response = self.git("GET", "info/refs", "service=git-upload-pack", self.fetch_grant())

        assert response.status_code == 200
        assert response["Content-Type"] == "application/x-git-upload-pack-advertisement"
        assert b"".join(response) == b"001e# service=git-upload-pack\n0000"
        upstream = responses.calls[0].request
        credentials = base64.b64encode(f"x-access-token:{TOKEN}".encode()).decode()
        assert upstream.headers["Authorization"] == f"Basic {credentials}"
        assert GRANT_HEADER not in upstream.headers

    @responses.activate
    def test_relays_a_push_body(self) -> None:
        responses.add(
            responses.POST,
            "https://github.com/getsentry/sentry.git/git-receive-pack",
            body=b"000eunpack ok\n0000",
            content_type="application/x-git-receive-pack-result",
        )
        grant = sign(self.organization.id, "push", [self.repo.id])

        response = self.git("POST", "git-receive-pack", "", grant, body=b"0000PACK-bytes")

        assert response.status_code == 200
        assert b"".join(response) == b"000eunpack ok\n0000"
        assert b"".join(responses.calls[0].request.body) == b"0000PACK-bytes"

    @responses.activate
    @mock.patch("sentry.scm.endpoints.scm_git.record_count_metric")
    def test_refuses_a_request_without_a_grant(self, mock_record_count: mock.MagicMock) -> None:
        response = self.git("GET", "info/refs", "service=git-upload-pack", "")

        self.assert_refused(response, 403, b"The git grant is missing.")
        mock_record_count.assert_called_once_with(
            "sentry.scm.git.request.failed", 1, {"code": "git_invalid_grant"}
        )

    @responses.activate
    def test_refuses_a_grant_signed_with_an_unknown_secret(self) -> None:
        grant = sign(self.organization.id, "fetch", [self.repo.id], secret="some-other-secret")

        response = self.git("GET", "info/refs", "service=git-upload-pack", grant)

        self.assert_refused(response, 403, b"not signed with a known secret")

    @responses.activate
    @override_settings(SCM_GIT_GRANT_SECRETS=None)
    def test_refuses_every_grant_when_no_secret_is_configured(self) -> None:
        response = self.git("GET", "info/refs", "service=git-upload-pack", self.fetch_grant())

        self.assert_refused(response, 403, b"not signed with a known secret")

    @responses.activate
    def test_refuses_an_expired_grant(self) -> None:
        grant = sign(self.organization.id, "fetch", [self.repo.id], expires_in=-1)

        response = self.git("GET", "info/refs", "service=git-upload-pack", grant)

        self.assert_refused(response, 403, b"The git grant has expired.")

    @responses.activate
    @mock.patch("sentry.scm.endpoints.scm_git.record_count_metric")
    def test_refuses_an_organization_without_the_feature(
        self, mock_record_count: mock.MagicMock
    ) -> None:
        with self.feature({FEATURE: False}):
            response = self.git("GET", "info/refs", "service=git-upload-pack", self.fetch_grant())

        self.assert_refused(response, 404, b"not enabled for this organization")
        mock_record_count.assert_called_once_with(
            "sentry.scm.git.request.failed", 1, {"code": "git_endpoint_disabled"}
        )

    @responses.activate
    def test_refuses_a_grant_for_an_organization_that_does_not_exist(self) -> None:
        grant = sign(self.organization.id + 1000, "fetch", [self.repo.id])

        response = self.git("GET", "info/refs", "service=git-upload-pack", grant)

        self.assert_refused(response, 404, b"organization was not found")

    @responses.activate
    def test_refuses_a_push_with_a_fetch_grant(self) -> None:
        response = self.git("GET", "info/refs", "service=git-receive-pack", self.fetch_grant())

        self.assert_refused(response, 403, b"The git grant allows fetch, not push.")

    @responses.activate
    def test_refuses_a_fetch_with_a_push_grant(self) -> None:
        grant = sign(self.organization.id, "push", [self.repo.id])

        response = self.git("POST", "git-upload-pack", "", grant, body=b"0000")

        self.assert_refused(response, 403, b"The git grant allows push, not fetch.")

    @responses.activate
    def test_refuses_a_route_git_does_not_use(self) -> None:
        response = self.git("GET", "HEAD", "", self.fetch_grant())

        self.assert_refused(response, 404, b"GET HEAD is not a git fetch or push route.")

    @responses.activate
    def test_refuses_a_repository_outside_the_grant(self) -> None:
        other_repo = self.create_repo(
            self.project,
            name="getsentry/other",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id="67890",
        )

        response = self.git(
            "GET", "info/refs", "service=git-upload-pack", self.fetch_grant(), other_repo.id
        )

        self.assert_refused(response, 403, b"The git grant does not cover this repository.")

    @responses.activate
    def test_refuses_a_grant_that_names_the_repository_by_external_id(self) -> None:
        grant = sign(self.organization.id, "fetch", [("github", "12345")])

        response = self.git("GET", "info/refs", "service=git-upload-pack", grant)

        self.assert_refused(response, 403, b"The git grant does not cover this repository.")

    @responses.activate
    def test_refuses_a_repository_the_organization_has_not_connected(self) -> None:
        unconnected_id = self.repo.id + 1000
        grant = sign(self.organization.id, "fetch", [unconnected_id])

        response = self.git("GET", "info/refs", "service=git-upload-pack", grant, unconnected_id)

        self.assert_refused(response, 404, b"A repository could not be found.")

    @responses.activate
    def test_refuses_another_organizations_repository(self) -> None:
        other_org = self.create_organization()
        other_integration = self.create_integration(
            organization=other_org,
            provider="github",
            external_id="2",
            metadata={"access_token": TOKEN, "expires_at": TOKEN_EXPIRES_AT},
        )
        other_repo = self.create_repo(
            self.create_project(organization=other_org),
            name="other-org/private",
            provider="integrations:github",
            integration_id=other_integration.id,
            external_id="24680",
        )
        grant = sign(self.organization.id, "fetch", [other_repo.id])

        response = self.git("GET", "info/refs", "service=git-upload-pack", grant, other_repo.id)

        self.assert_refused(response, 404, b"A repository could not be found.")

    @responses.activate
    @mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk.capture_exception")
    @mock.patch(
        "sentry.scm.endpoints.scm_git.integration_service.refresh_github_access_token",
        side_effect=ApiError("Forbidden", code=403),
    )
    def test_answers_a_token_github_refuses_to_mint_with_a_bad_gateway(
        self, mock_refresh: mock.MagicMock, mock_capture_exception: mock.MagicMock
    ) -> None:
        response = self.git("GET", "info/refs", "service=git-upload-pack", self.fetch_grant())

        self.assert_refused(
            response, 502, b"Sentry could not get a github token for this repository."
        )
        mock_capture_exception.assert_called_once_with()

    @responses.activate
    def test_refuses_a_route_with_a_trailing_slash(self) -> None:
        response = self.git("GET", "info/refs/", "service=git-upload-pack", self.fetch_grant())

        self.assert_refused(response, 404, b"is not a git fetch or push route.")

    @responses.activate
    def test_refuses_an_inactive_repository(self) -> None:
        self.repo.update(status=ObjectStatus.DISABLED)

        response = self.git("GET", "info/refs", "service=git-upload-pack", self.fetch_grant())

        assert response.status_code == 404
        assert len(responses.calls) == 0

    def test_answers_a_provider_host_on_an_internal_address_with_a_host_error(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            external_id="github_enterprise_external_id",
            metadata={
                "domain_name": "127.0.0.1/getsentry",
                "installation": {"private_key": "private_key", "id": 1, "verify_ssl": True},
                "installation_id": 1234,
                "access_token": TOKEN,
                "expires_at": TOKEN_EXPIRES_AT,
            },
        )
        repo = self.create_repo(
            self.project,
            name="getsentry/internal",
            provider="integrations:github_enterprise",
            integration_id=integration.id,
            external_id="13579",
        )
        grant = sign(self.organization.id, "fetch", [repo.id])

        response = self.git("GET", "info/refs", "service=git-upload-pack", grant, repo.id)

        assert response.status_code == 503
        assert response["Content-Type"] == "text/plain; charset=utf-8"
        assert b"".join(response) == b"Unable to reach host\n"


@pytest.mark.parametrize(
    "path",
    [
        "/api/0/internal/scm-git/repositories/getsentry/sentry.git/info/refs",
        "/api/0/internal/scm-git/repositories/42/info/refs",
        "/api/0/internal/scm-git/repositories/42.git/",
        "/api/0/internal/scm-git/repositories/42.git",
        # More digits than any Repository.id, which int() would refuse with a 500 at 4,301.
        f"/api/0/internal/scm-git/repositories/{'4' * 20}.git/info/refs",
        # Arabic-Indic digits, which int() would read as 42.
        "/api/0/internal/scm-git/repositories/\u0664\u0662.git/info/refs",
    ],
    ids=[
        "name",
        "no-git-suffix",
        "nothing-after-git",
        "no-slash-after-git",
        "20-digits",
        "arabic-indic",
    ],
)
def test_does_not_route(path: str) -> None:
    assert resolve(path).url_name == "sentry-api-catchall"


def test_the_sdk_filters_the_grant_header_out_of_telemetry() -> None:
    behaviour = settings.SENTRY_SDK_CONFIG["data_collection"]["http_headers"]["request"]

    filtered = _apply_key_value_collection_filtering({GRANT_HEADER: "a.signed.grant"}, behaviour)

    assert filtered == {GRANT_HEADER: "[Filtered]"}


@cell_silo_test
class GetGitTokenTest(TestCase):
    def scm_repository(self, provider_name: str, integration_id: int) -> ScmRepository:
        return ScmRepository(
            external_id="1",
            id=1,
            integration_id=integration_id,
            is_active=True,
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider_name=provider_name,  # type: ignore[typeddict-item]
            web_base_url=None,
            installation_id=None,
        )

    def test_returns_the_github_installation_token(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="1",
            metadata={"access_token": TOKEN, "expires_at": TOKEN_EXPIRES_AT},
        )

        token = get_git_token(self.scm_repository("github", integration.id), "fetch")

        assert token == TOKEN

    def test_returns_none_for_an_integration_the_organization_does_not_have(self) -> None:
        integration = self.create_integration(
            organization=self.create_organization(),
            provider="github",
            external_id="2",
            metadata={"access_token": TOKEN, "expires_at": TOKEN_EXPIRES_AT},
        )

        token = get_git_token(self.scm_repository("github", integration.id), "fetch")

        assert token is None

    def test_refuses_gitlab(self) -> None:
        with pytest.raises(GitProviderNotSupported):
            get_git_token(self.scm_repository("gitlab", 1), "fetch")

    def test_refuses_cursor_origin(self) -> None:
        with pytest.raises(GitProviderNotSupported):
            get_git_token(self.scm_repository("cursor_origin", 1), "fetch")
