from __future__ import annotations

import base64
import time
from collections.abc import Callable, Sequence
from typing import Any, NamedTuple
from unittest import mock

import pytest
import responses
import sentry_sdk
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)
from django.conf import settings
from django.core.signals import request_finished
from django.db import close_old_connections
from django.http import HttpResponseBase
from django.test import RequestFactory, override_settings
from django.test.client import ClientHandler
from django.urls import resolve, reverse
from requests import PreparedRequest
from responses import matchers
from scm import Secret
from scm.git.grant import sign_grant
from scm.git.types import GRANT_HEADER, GitOperation, Grant
from scm.types import RepositoryId
from sentry_sdk import traces
from sentry_sdk.data_collection import _apply_key_value_collection_filtering
from sentry_sdk.integrations.wsgi import SentryWsgiMiddleware

from sentry.constants import ObjectStatus
from sentry.scm.endpoints.scm_git import report_git_error
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import cell_silo_test
from sentry.utils.sdk import traces_sampler

TOKEN = "ghs_installation_token"
GITLAB_TOKEN = "gitlab_oauth_token"
FEATURE = "organizations:scm-git-endpoint"
REFERRER = "seer.coding_job"
# Far enough ahead that the GitHub client never refreshes the token over the network.
TOKEN_EXPIRES_AT = "3000-01-01T00:00:00"


class KeyPair(NamedTuple):
    private: Secret
    """The private key in PEM, as Seer signs grants with it."""
    public: str
    """The public key in PEM, as SCM_GIT_GRANT_PUBLIC_KEYS lists it."""


def make_key_pair() -> KeyPair:
    # Generated, so no private key is committed.
    key = Ed25519PrivateKey.generate()
    private_pem = key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    public_pem = key.public_key().public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
    return KeyPair(private=Secret(private_pem.decode()), public=public_pem.decode())


KEY = make_key_pair()


def sign(
    organization_id: int,
    operation: GitOperation,
    repositories: Sequence[RepositoryId],
    *,
    expires_in: int = 300,
    key: KeyPair = KEY,
) -> str:
    grant = Grant(
        organization_id=organization_id,
        operation=operation,
        repositories=list(repositories),
        expires_at=int(time.time()) + expires_in,
        referrer=REFERRER,
    )
    return sign_grant(key.private, grant)


@cell_silo_test
@override_settings(SCM_GIT_GRANT_PUBLIC_KEYS=[KEY.public])
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
        return self.client.generic(
            method,
            f"{url}?{query}",
            data=body,
            content_type="application/x-git-request",
            headers={GRANT_HEADER: grant},
        )

    def fetch_refs(self, grant: str, repository_id: int | None = None) -> HttpResponseBase:
        return self.git("GET", "info/refs", "service=git-upload-pack", grant, repository_id)

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
        grant = sign(self.organization.id, "push", [self.repo.id])

        response = self.git("POST", "git-receive-pack", "", grant, body=b"0000PACK-bytes")

        assert response.status_code == 200
        assert b"".join(response) == b"000eunpack ok\n0000"
        assert b"".join(responses.calls[0].request.body) == b"0000PACK-bytes"

    @responses.activate
    @override_settings(SENTRY_BACKEND_APM_SAMPLING=0)
    def test_continues_the_callers_trace(self) -> None:
        # Seer and the credential proxy send sentry-trace with every git request, without baggage,
        # so a fetch or push joins the trace of the step that ran it. The flag is the caller's
        # sampling decision, and the endpoint's own sample rate decides without one.
        incoming_trace, incoming_span = "771a43a4192642f0b136d5159a501700", "b0e6f15b45c36b12"
        for flag, sampled in (("-1", True), ("-0", False), ("", False)):
            seen: list[traces.StreamedSpan] = []

            def advertise(request: PreparedRequest) -> tuple[int, dict[str, str], bytes]:
                current = traces.get_current_span()
                assert isinstance(current, traces.StreamedSpan)
                seen.append(current)
                return 200, {}, b"001e# service=git-upload-pack\n0000"

            responses.reset()
            responses.add_callback(
                responses.GET,
                "https://github.com/getsentry/sentry.git/info/refs",
                callback=advertise,
                content_type="application/x-git-upload-pack-advertisement",
            )

            status, body = self.serve_through_sdk(
                "info/refs",
                "service=git-upload-pack",
                {
                    GRANT_HEADER: self.fetch_grant(),
                    "sentry-trace": f"{incoming_trace}-{incoming_span}{flag}",
                },
            )

            assert (status, body) == ("200 OK", b"001e# service=git-upload-pack\n0000")
            [span] = seen
            assert span.trace_id == incoming_trace
            assert span._segment._parent_span_id == incoming_span
            assert span._segment.sampled is sampled
            # Sentry's trace stays in Sentry.
            assert "sentry-trace" not in responses.calls[0].request.headers

    def serve_through_sdk(
        self, route: str, query: str, headers: dict[str, str]
    ) -> tuple[str, bytes]:
        """Serve a request the way a deployed Sentry does, inside the SDK's WSGI middleware.

        Tests run without an SDK client, so this one starts a streaming client like
        sentry.utils.sdk's and takes it back afterwards.
        """
        url = reverse(
            "sentry-api-0-scm-git", kwargs={"repository_id": self.repo.id, "route": route}
        )
        environ = RequestFactory().get(f"{url}?{query}", headers=headers).environ
        handler = ClientHandler()

        def app(environ: dict[str, Any], start_response: Callable[..., Any]) -> HttpResponseBase:
            response = handler(environ)
            start_response(f"{response.status_code} {response.reason_phrase}", response.items())
            return response

        statuses: list[str] = []
        previous_client = sentry_sdk.get_client()
        sentry_sdk.init(
            default_integrations=False,
            auto_enabling_integrations=False,
            trace_lifecycle="stream",
            traces_sampler=traces_sampler,
        )
        try:
            body = SentryWsgiMiddleware(app)(environ, lambda status, _: statuses.append(status))
            try:
                return statuses[0], b"".join(body)
            finally:
                # A WSGI server closes the body, which sends request_finished. As in Django's test
                # client, that mustn't close the test's database connection.
                request_finished.disconnect(close_old_connections)
                try:
                    body.close()
                finally:
                    request_finished.connect(close_old_connections)
        finally:
            sentry_sdk.get_global_scope().set_client(previous_client)

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
                "repository_id": str(self.repo.id),
            },
        )
        self.assert_reported_message(mock_sdk, "The git grant is missing.")
        self.assert_reported(mock_sdk, "git_invalid_grant", {"repository_id": str(self.repo.id)})

    @responses.activate
    @mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk")
    @mock.patch("sentry.scm.endpoints.scm_git.record_count_metric")
    def test_refuses_a_grant_signed_with_an_unknown_key_without_its_referrer(
        self, mock_record_count: mock.MagicMock, mock_sdk: mock.MagicMock
    ) -> None:
        # Anyone can write a referrer into a grant they sign themselves, so only a verified one
        # may tag metrics and issues.
        grant = sign(self.organization.id, "fetch", [self.repo.id], key=make_key_pair())

        response = self.fetch_refs(grant)

        self.assert_refused(response, 403, b"not signed with a known key")
        mock_record_count.assert_called_once_with(
            "sentry.scm.git.request.failed", 1, {"code": "git_invalid_grant"}
        )
        self.assert_reported_message(mock_sdk, "The git grant was not signed with a known key.")
        self.assert_reported(mock_sdk, "git_invalid_grant", {"repository_id": str(self.repo.id)})

    @responses.activate
    def test_accepts_a_grant_signed_with_any_listed_key(self) -> None:
        # During a rotation Sentry lists the old and the new public key, and Seer may sign with
        # either.
        new_key = make_key_pair()
        responses.add(
            responses.GET,
            "https://github.com/getsentry/sentry.git/info/refs",
            body=b"0000",
            content_type="application/x-git-upload-pack-advertisement",
        )

        with override_settings(SCM_GIT_GRANT_PUBLIC_KEYS=[KEY.public, new_key.public]):
            response = self.fetch_refs(
                sign(self.organization.id, "fetch", [self.repo.id], key=new_key)
            )

        assert response.status_code == 200

    @responses.activate
    @override_settings(SCM_GIT_GRANT_PUBLIC_KEYS=[])
    @mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk")
    @mock.patch("sentry.scm.endpoints.scm_git.record_count_metric")
    def test_refuses_every_grant_when_no_public_key_is_configured(
        self, mock_record_count: mock.MagicMock, mock_sdk: mock.MagicMock
    ) -> None:
        response = self.fetch_refs(self.fetch_grant())

        self.assert_refused(response, 503, b"SCM_GIT_GRANT_PUBLIC_KEYS is misconfigured")
        mock_record_count.assert_called_once_with(
            "sentry.scm.git.request.failed", 1, {"code": "grant_public_keys_invalid"}
        )
        self.assert_reported(
            mock_sdk, "grant_public_keys_invalid", {"repository_id": str(self.repo.id)}
        )

    @responses.activate
    @mock.patch("sentry.scm.endpoints.scm_git.sentry_sdk")
    def test_refuses_every_grant_without_quoting_a_misplaced_private_key(
        self, mock_sdk: mock.MagicMock
    ) -> None:
        private_pem = KEY.private.reveal()

        with override_settings(SCM_GIT_GRANT_PUBLIC_KEYS=[private_pem]):
            response = self.fetch_refs(self.fetch_grant())

        self.assert_refused(response, 503, b"public_keys[0] is a private key")
        body = b"".join(response).decode()
        (detail,), _ = mock_sdk.capture_message.call_args
        key_body = private_pem.splitlines()[1]
        assert key_body not in body
        assert key_body not in detail

    @responses.activate
    def test_refuses_an_expired_grant(self) -> None:
        grant = sign(self.organization.id, "fetch", [self.repo.id], expires_in=-1)

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
                "repository_id": str(self.repo.id),
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
                "repository_id": str(self.repo.id),
                "organization_id": str(self.organization.id),
                "referrer": REFERRER,
            },
        )

    @responses.activate
    def test_refuses_a_grant_for_an_organization_that_does_not_exist(self) -> None:
        grant = sign(self.organization.id + 1000, "fetch", [self.repo.id])

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
                "repository_id": str(self.repo.id),
                "organization_id": str(self.organization.id),
                "referrer": REFERRER,
            },
        )
        self.assert_reported_message(mock_sdk, "The git grant allows fetch, not push.")
        self.assert_reported(
            mock_sdk,
            "git_operation_not_granted",
            {
                "repository_id": str(self.repo.id),
                "organization_id": str(self.organization.id),
                "referrer": REFERRER,
            },
        )

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

        response = self.fetch_refs(self.fetch_grant(), other_repo.id)

        self.assert_refused(response, 403, b"The git grant does not cover this repository.")

    @responses.activate
    def test_refuses_a_grant_that_names_the_repository_by_external_id(self) -> None:
        grant = sign(self.organization.id, "fetch", [("github", "12345")])

        response = self.fetch_refs(grant)

        self.assert_refused(response, 403, b"The git grant does not cover this repository.")

    @responses.activate
    def test_refuses_a_repository_the_organization_has_not_connected(self) -> None:
        unconnected_id = self.repo.id + 1000
        grant = sign(self.organization.id, "fetch", [unconnected_id])

        response = self.fetch_refs(grant, unconnected_id)

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

        response = self.fetch_refs(grant, other_repo.id)

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
        grant = sign(self.organization.id, "fetch", [repo.id])

        response = self.fetch_refs(grant, repo.id)

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
        grant = sign(self.organization.id, "fetch", [repo.id])

        response = self.fetch_refs(grant, repo.id)

        assert response.status_code == 503
        assert response["Content-Type"] == "text/plain; charset=utf-8"
        assert b"".join(response) == b"Unable to reach host\n"
        mock_logger.error.assert_called_once_with(
            "scm.git.request_failed",
            extra={
                "code": "restricted_ip_address",
                "detail": "The provider host resolves to an address Sentry doesn't connect to.",
                "repository_id": str(repo.id),
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
                "repository_id": str(repo.id),
                "organization_id": str(self.organization.id),
                "referrer": REFERRER,
            },
        )


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
