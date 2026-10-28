from __future__ import annotations

import base64
import time
from collections.abc import Sequence
from typing import cast
from unittest import mock

import pytest
import responses
from django.conf import settings
from django.http import HttpResponseBase
from django.test import override_settings
from django.urls import resolve, reverse
from responses import matchers
from scm import Secret
from scm.git.grant import sign_grant
from scm.git.types import GRANT_HEADER, GitOperation, Grant
from scm.types import PROVIDER_SET, ProviderName, RepositoryId
from sentry_sdk.data_collection import _apply_key_value_collection_filtering

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository
from sentry.scm.endpoints.scm_git import report_git_error
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import cell_silo_test

SECRET = "a-long-value-that-is-hard-to-guess"
TOKEN = "ghs_installation_token"
GITLAB_TOKEN = "gitlab_oauth_token"
FEATURE = "organizations:scm-git-endpoint"
REFERRER = "seer.coding_job"
# Far enough ahead that the GitHub client never refreshes the token over the network.
TOKEN_EXPIRES_AT = "3000-01-01T00:00:00"
# How refusals tag the test's GitHub repository, the same way GitServer tags its own.
REPOSITORY_TAG = "('github', '12345')"


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
        repositories=list(repositories),
        expires_at=int(time.time()) + expires_in,
        referrer=REFERRER,
    )
    return sign_grant(Secret(secret), grant)


def repository_id(repo: Repository) -> tuple[ProviderName, str]:
    assert repo.provider is not None and repo.external_id is not None
    return (cast(ProviderName, repo.provider.removeprefix("integrations:")), repo.external_id)


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
        return sign(self.organization.id, "fetch", [repository_id(self.repo)])

    def git(
        self,
        method: str,
        route: str,
        query: str,
        grant: str,
        repo: tuple[ProviderName, str] | None = None,
        body: bytes = b"",
    ) -> HttpResponseBase:
        provider, external_id = repo or repository_id(self.repo)
        url = reverse(
            "sentry-api-0-scm-git",
            kwargs={"provider": provider, "external_id": external_id, "route": route},
        )
        return self.client.generic(
            method,
            f"{url}?{query}",
            data=body,
            content_type="application/x-git-request",
            headers={GRANT_HEADER: grant},
        )

    def fetch_refs(
        self, grant: str, repo: tuple[ProviderName, str] | None = None
    ) -> HttpResponseBase:
        return self.git("GET", "info/refs", "service=git-upload-pack", grant, repo)

    def assert_refused(self, response: HttpResponseBase, status: int, message: bytes) -> None:
        assert response.status_code == status
        assert response["Content-Type"] == "text/plain; charset=utf-8"
        assert message in b"".join(response)
        assert len(responses.calls) == 0

    def assert_reported(self, mock_sdk: mock.MagicMock, code: str, tags: dict[str, str]) -> None:
        scope = mock_sdk.new_scope.return_value.__enter__.return_value
        assert scope.fingerprint == ["scm-git", code]
        scope.set_tags.assert_called_once_with(tags)

    def assert_reported_message(self, mock_sdk: mock.MagicMock, detail: str) -> None:
        # Never the exception, whose frames hold the provider token.
        mock_sdk.capture_message.assert_called_once_with(detail, level="error")
        mock_sdk.capture_exception.assert_not_called()

    @responses.activate
    @mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk")
    def test_relays_a_fetch_with_the_installation_token(self, mock_sdk: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            "https://github.com/getsentry/sentry.git/info/refs",
            match=[matchers.query_string_matcher("service=git-upload-pack")],
            body=b"001e# service=git-upload-pack\n0000",
            content_type="application/x-git-upload-pack-advertisement",
        )

        response = self.fetch_refs(self.fetch_grant())

        assert response.status_code == 200
        assert response["Content-Type"] == "application/x-git-upload-pack-advertisement"
        assert b"".join(response) == b"001e# service=git-upload-pack\n0000"
        upstream = responses.calls[0].request
        credentials = base64.b64encode(f"x-access-token:{TOKEN}".encode()).decode()
        assert upstream.headers["Authorization"] == f"Basic {credentials}"
        assert GRANT_HEADER not in upstream.headers
        mock_sdk.capture_exception.assert_not_called()
        mock_sdk.capture_message.assert_not_called()

    @responses.activate
    def test_relays_a_push_body(self) -> None:
        responses.add(
            responses.POST,
            "https://github.com/getsentry/sentry.git/git-receive-pack",
            body=b"000eunpack ok\n0000",
            content_type="application/x-git-receive-pack-result",
        )
        grant = sign(self.organization.id, "push", [repository_id(self.repo)])

        response = self.git("POST", "git-receive-pack", "", grant, body=b"0000PACK-bytes")

        assert response.status_code == 200
        assert b"".join(response) == b"000eunpack ok\n0000"
        assert b"".join(responses.calls[0].request.body) == b"0000PACK-bytes"

    @responses.activate
    @mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk")
    @mock.patch("sentry.scm.endpoints.scm_git.logger")
    @mock.patch("sentry.scm.endpoints.scm_git.record_count_metric")
    def test_refuses_a_request_without_a_grant(
        self,
        mock_record_count: mock.MagicMock,
        mock_logger: mock.MagicMock,
        mock_sdk: mock.MagicMock,
    ) -> None:
        response = self.fetch_refs("")

        self.assert_refused(response, 403, b"The git grant is missing.")
        mock_record_count.assert_called_once_with(
            "sentry.scm.git.request.failed", 1, {"code": "git_invalid_grant"}
        )
        mock_logger.error.assert_called_once_with(
            "scm.git.request_failed",
            extra={
                "code": "git_invalid_grant",
                "detail": "The git grant is missing.",
                "repository_id": REPOSITORY_TAG,
            },
        )
        self.assert_reported_message(mock_sdk, "The git grant is missing.")
        self.assert_reported(mock_sdk, "git_invalid_grant", {"repository_id": REPOSITORY_TAG})

    @responses.activate
    @mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk")
    @mock.patch("sentry.scm.endpoints.scm_git.record_count_metric")
    def test_refuses_a_grant_signed_with_an_unknown_secret_without_its_referrer(
        self, mock_record_count: mock.MagicMock, mock_sdk: mock.MagicMock
    ) -> None:
        # Anyone can write a referrer into a grant they sign themselves, so only a verified one
        # may tag metrics and issues.
        grant = sign(
            self.organization.id, "fetch", [repository_id(self.repo)], secret="some-other-secret"
        )

        response = self.fetch_refs(grant)

        self.assert_refused(response, 403, b"not signed with a known secret")
        mock_record_count.assert_called_once_with(
            "sentry.scm.git.request.failed", 1, {"code": "git_invalid_grant"}
        )
        self.assert_reported_message(mock_sdk, "The git grant was not signed with a known secret.")
        self.assert_reported(mock_sdk, "git_invalid_grant", {"repository_id": REPOSITORY_TAG})

    @responses.activate
    @override_settings(SCM_GIT_GRANT_SECRETS=None)
    def test_refuses_every_grant_when_no_secret_is_configured(self) -> None:
        response = self.fetch_refs(self.fetch_grant())

        self.assert_refused(response, 403, b"not signed with a known secret")

    @responses.activate
    def test_refuses_an_expired_grant(self) -> None:
        grant = sign(self.organization.id, "fetch", [repository_id(self.repo)], expires_in=-1)

        response = self.fetch_refs(grant)

        self.assert_refused(response, 403, b"The git grant has expired.")

    @responses.activate
    @mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk")
    @mock.patch("sentry.scm.endpoints.scm_git.logger")
    @mock.patch("sentry.scm.endpoints.scm_git.record_count_metric")
    def test_refuses_an_organization_without_the_feature(
        self,
        mock_record_count: mock.MagicMock,
        mock_logger: mock.MagicMock,
        mock_sdk: mock.MagicMock,
    ) -> None:
        with self.feature({FEATURE: False}):
            response = self.fetch_refs(self.fetch_grant())

        self.assert_refused(response, 404, b"not enabled for this organization")
        mock_record_count.assert_called_once_with(
            "sentry.scm.git.request.failed",
            1,
            {"code": "git_endpoint_disabled", "referrer": REFERRER},
        )
        mock_logger.error.assert_called_once_with(
            "scm.git.request_failed",
            extra={
                "code": "git_endpoint_disabled",
                "detail": "The git endpoint is not enabled for this organization.",
                "repository_id": REPOSITORY_TAG,
                "organization_id": str(self.organization.id),
                "referrer": REFERRER,
            },
        )
        self.assert_reported_message(
            mock_sdk, "The git endpoint is not enabled for this organization."
        )
        self.assert_reported(
            mock_sdk,
            "git_endpoint_disabled",
            {
                "repository_id": REPOSITORY_TAG,
                "organization_id": str(self.organization.id),
                "referrer": REFERRER,
            },
        )

    @responses.activate
    def test_refuses_a_grant_for_an_organization_that_does_not_exist(self) -> None:
        grant = sign(self.organization.id + 1000, "fetch", [repository_id(self.repo)])

        response = self.fetch_refs(grant)

        self.assert_refused(response, 404, b"organization was not found")

    @responses.activate
    def test_refuses_a_push_with_a_fetch_grant(self) -> None:
        response = self.git("GET", "info/refs", "service=git-receive-pack", self.fetch_grant())

        self.assert_refused(response, 403, b"The git grant allows fetch, not push.")

    @responses.activate
    @mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk")
    @mock.patch("sentry.scm.endpoints.scm_git.logger")
    def test_reports_a_refusal_with_what_the_request_resolved(
        self, mock_logger: mock.MagicMock, mock_sdk: mock.MagicMock
    ) -> None:
        response = self.git("GET", "info/refs", "service=git-receive-pack", self.fetch_grant())

        self.assert_refused(response, 403, b"The git grant allows fetch, not push.")
        mock_logger.error.assert_called_once_with(
            "scm.git.request_failed",
            extra={
                "code": "git_operation_not_granted",
                "detail": "The git grant allows fetch, not push.",
                "repository_id": REPOSITORY_TAG,
                "organization_id": str(self.organization.id),
                "referrer": REFERRER,
            },
        )
        self.assert_reported_message(mock_sdk, "The git grant allows fetch, not push.")
        self.assert_reported(
            mock_sdk,
            "git_operation_not_granted",
            {
                "repository_id": REPOSITORY_TAG,
                "organization_id": str(self.organization.id),
                "referrer": REFERRER,
            },
        )

    @responses.activate
    def test_refuses_a_fetch_with_a_push_grant(self) -> None:
        grant = sign(self.organization.id, "push", [repository_id(self.repo)])

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

        response = self.fetch_refs(self.fetch_grant(), repository_id(other_repo))

        self.assert_refused(response, 403, b"The git grant does not cover this repository.")

    @responses.activate
    def test_refuses_a_grant_that_names_the_repository_by_its_sentry_id(self) -> None:
        # authorize_request matches the request's form exactly, so the same repository's database
        # id doesn't cover it.
        grant = sign(self.organization.id, "fetch", [self.repo.id])

        response = self.fetch_refs(grant)

        self.assert_refused(response, 403, b"The git grant does not cover this repository.")

    @responses.activate
    def test_refuses_a_repository_the_organization_has_not_connected(self) -> None:
        unconnected: tuple[ProviderName, str] = ("github", "99999")
        grant = sign(self.organization.id, "fetch", [unconnected])

        response = self.fetch_refs(grant, unconnected)

        self.assert_refused(response, 404, b"A repository could not be found.")

    @responses.activate
    def test_refuses_a_repository_named_like_the_granted_external_id(self) -> None:
        # A name is chosen on the provider, so a repository named after the granted external id
        # mustn't stand in for the repository that has it.
        self.create_repo(
            self.project,
            name="99999",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id="67890",
        )
        granted: tuple[ProviderName, str] = ("github", "99999")
        grant = sign(self.organization.id, "fetch", [granted])

        response = self.fetch_refs(grant, granted)

        self.assert_refused(response, 404, b"A repository could not be found.")

    @responses.activate
    def test_answers_an_unknown_provider_with_a_not_found(self) -> None:
        grant = sign(self.organization.id, "fetch", [repository_id(self.repo)])

        response = self.client.get(
            "/api/0/internal/scm-git/repositories/gitea/12345.git/info/refs?service=git-upload-pack",
            headers={GRANT_HEADER: grant},
        )

        assert response.status_code == 404
        assert len(responses.calls) == 0

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
        grant = sign(self.organization.id, "fetch", [repository_id(other_repo)])

        response = self.fetch_refs(grant, repository_id(other_repo))

        self.assert_refused(response, 404, b"A repository could not be found.")

    @responses.activate
    @mock.patch(
        "sentry.scm.private.helpers.integration_service.get_access_token", return_value=None
    )
    def test_answers_a_token_control_cannot_get_with_a_bad_gateway(
        self, mock_get_access_token: mock.MagicMock
    ) -> None:
        response = self.fetch_refs(self.fetch_grant())

        self.assert_refused(
            response, 502, b"Sentry could not get a github token for this repository."
        )

    @responses.activate
    def test_relays_a_gitlab_fetch_with_the_identity_token(self) -> None:
        identity_provider = self.create_identity_provider(
            type="gitlab", external_id="gitlab.com:acme"
        )
        identity = self.create_identity(
            self.user, identity_provider, "gitlab-user", data={"access_token": GITLAB_TOKEN}
        )
        integration = self.create_integration(
            organization=self.organization,
            provider="gitlab",
            external_id="gitlab.com:acme",
            metadata={
                "instance": "gitlab.com",
                "base_url": "https://gitlab.com",
                "verify_ssl": True,
            },
            oi_params={"default_auth_id": identity.id},
        )
        repo = self.create_repo(
            self.project,
            name="acme / widget",
            provider="integrations:gitlab",
            integration_id=integration.id,
            external_id="gitlab.com:42",
        )
        repo.update(config={"path": "acme/widget"})
        responses.add(
            responses.GET,
            "https://gitlab.com/acme/widget.git/info/refs",
            match=[matchers.query_string_matcher("service=git-upload-pack")],
            body=b"001e# service=git-upload-pack\n0000",
            content_type="application/x-git-upload-pack-advertisement",
        )
        grant = sign(self.organization.id, "fetch", [("gitlab", "gitlab.com:42")])

        # Percent-encoded, as Seer sends it.
        response = self.client.get(
            "/api/0/internal/scm-git/repositories/gitlab/gitlab.com%3A42.git/info/refs"
            "?service=git-upload-pack",
            headers={GRANT_HEADER: grant},
        )

        assert response.status_code == 200
        assert b"".join(response) == b"001e# service=git-upload-pack\n0000"
        credentials = base64.b64encode(f"oauth2:{GITLAB_TOKEN}".encode()).decode()
        assert responses.calls[0].request.headers["Authorization"] == f"Basic {credentials}"

    @responses.activate
    def test_refuses_a_route_with_a_trailing_slash(self) -> None:
        response = self.git("GET", "info/refs/", "service=git-upload-pack", self.fetch_grant())

        self.assert_refused(response, 404, b"is not a git fetch or push route.")

    @responses.activate
    def test_refuses_an_inactive_repository(self) -> None:
        self.repo.update(status=ObjectStatus.DISABLED)

        response = self.fetch_refs(self.fetch_grant())

        self.assert_refused(response, 404, b"A repository was found but it is inactive.")

    @mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk")
    @mock.patch("sentry.scm.endpoints.scm_git.logger")
    def test_answers_a_provider_host_on_an_internal_address_with_a_host_error(
        self, mock_logger: mock.MagicMock, mock_sdk: mock.MagicMock
    ) -> None:
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
        grant = sign(self.organization.id, "fetch", [repository_id(repo)])

        response = self.fetch_refs(grant, repository_id(repo))

        assert response.status_code == 503
        assert response["Content-Type"] == "text/plain; charset=utf-8"
        assert b"".join(response) == b"Unable to reach host\n"
        mock_logger.error.assert_called_once_with(
            "scm.git.request_failed",
            extra={
                "code": "restricted_ip_address",
                "detail": "The provider host resolves to an address Sentry doesn't connect to.",
                "repository_id": str(("github_enterprise", "13579")),
                "organization_id": str(self.organization.id),
                "referrer": REFERRER,
            },
        )
        self.assert_reported_message(
            mock_sdk, "The provider host resolves to an address Sentry doesn't connect to."
        )
        self.assert_reported(
            mock_sdk,
            "restricted_ip_address",
            {
                "repository_id": str(("github_enterprise", "13579")),
                "organization_id": str(self.organization.id),
                "referrer": REFERRER,
            },
        )


@pytest.mark.parametrize("provider", sorted(PROVIDER_SET))
def test_routes_every_provider(provider: str) -> None:
    match = resolve(f"/api/0/internal/scm-git/repositories/{provider}/42.git/info/refs")

    assert match.url_name == "sentry-api-0-scm-git"
    assert match.kwargs == {"provider": provider, "external_id": "42", "route": "info/refs"}


@pytest.mark.parametrize(
    "path",
    [
        "/api/0/internal/scm-git/repositories/gitea/42.git/info/refs",
        "/api/0/internal/scm-git/repositories/42.git/info/refs",
        "/api/0/internal/scm-git/repositories/github/getsentry/sentry.git/info/refs",
        "/api/0/internal/scm-git/repositories/github/.git/info/refs",
        "/api/0/internal/scm-git/repositories/github/42/info/refs",
        "/api/0/internal/scm-git/repositories/github/42.git/",
        "/api/0/internal/scm-git/repositories/github/42.git",
    ],
    ids=[
        "unknown-provider",
        "no-provider",
        "slash-in-external-id",
        "empty-external-id",
        "no-git-suffix",
        "nothing-after-git",
        "no-slash-after-git",
    ],
)
def test_does_not_route(path: str) -> None:
    assert resolve(path).url_name == "sentry-api-catchall"


@mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk")
@mock.patch("sentry.scm.endpoints.scm_git.logger")
def test_reports_an_uncoded_error_by_its_name_alone(
    mock_logger: mock.MagicMock, mock_sdk: mock.MagicMock
) -> None:
    error = ValueError("https://x-access-token:a-token@github.com/getsentry/sentry.git")

    report_git_error(error, {"repository_id": "1"})

    mock_logger.error.assert_called_once_with(
        "scm.git.request_failed",
        extra={"code": "ValueError", "detail": "ValueError", "repository_id": "1"},
    )
    mock_sdk.capture_message.assert_called_once_with("ValueError", level="error")
    mock_sdk.capture_exception.assert_not_called()


def test_the_sdk_filters_the_grant_header_out_of_telemetry() -> None:
    behaviour = settings.SENTRY_SDK_CONFIG["data_collection"]["http_headers"]["request"]

    filtered = _apply_key_value_collection_filtering({GRANT_HEADER: "a.signed.grant"}, behaviour)

    assert filtered == {GRANT_HEADER: "[Filtered]"}
