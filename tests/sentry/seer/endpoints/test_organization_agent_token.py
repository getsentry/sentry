from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from sentry.apidocs.hooks import CustomEndpointEnumerator
from sentry.issues.endpoints.group_tags import GroupTagsEndpoint
from sentry.roles import organization_roles
from sentry.seer import agent_token
from sentry.seer.models.agent_write_grant import SeerAgentWriteGrant
from sentry.service_accounts.models import GRANTABLE_SCOPES
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode

SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"
FLAG = "organizations:seer-agent-token-flow"


class MatrixAuthentication(StrEnum):
    SESSION = "session"
    USER_TOKEN = "user_token"
    VIEWER_CONTEXT = "viewer_context"
    AGENT_TOKEN = "agent_token"
    SCOPED_DOWN_AGENT_TOKEN = "scoped_down_agent_token"
    APPROVED_AGENT_TOKEN = "approved_agent_token"
    SERVICE_ACCOUNT_VIEWER_CONTEXT = "service_account_viewer_context"


@dataclass(frozen=True)
class PublicGetEndpoint:
    path_template: str
    endpoint_name: str
    allowed_scopes: frozenset[str]
    silo_mode: SiloMode | None

    @property
    def test_id(self) -> str:
        return self.endpoint_name.removesuffix("Endpoint")


@dataclass(frozen=True)
class PublicMutationEndpoint:
    path_template: str
    endpoint_name: str
    method: str
    allowed_scopes: frozenset[str]
    silo_mode: SiloMode | None

    @property
    def test_id(self) -> str:
        return f"{self.endpoint_name.removesuffix('Endpoint')}_{self.method.lower()}"


def _declared_scopes(view: type[Any], method: str) -> frozenset[str]:
    scopes: set[str] = set()
    for permission_class in view.permission_classes:
        scopes.update(getattr(permission_class, "scope_map", {}).get(method, ()))
    assert scopes, (view.__name__, method)
    return frozenset(scopes)


class _CollectionSafeEndpointEnumerator(CustomEndpointEnumerator):
    """Inspect declared HTTP methods without constructing every endpoint view."""

    def get_allowed_methods(self, callback: Any) -> list[str]:
        if hasattr(callback, "actions"):
            method_names = callback.initkwargs.get(
                "http_method_names", callback.cls.http_method_names
            )
            methods = set(callback.actions) & set(method_names)
        else:
            method_names = callback.initkwargs.get(
                "http_method_names", callback.cls.http_method_names
            )
            methods = {method for method in method_names if hasattr(callback.cls, method)}
        return [
            method.upper()
            for method in methods
            if method.upper() not in {"OPTIONS", "HEAD", "TRACE", "CONNECT"}
        ]


def _public_get_endpoints() -> tuple[PublicGetEndpoint, ...]:
    """Return every canonical public GET endpoint from Sentry's live URL metadata.

    Group endpoints have both legacy ``/issues/{id}/`` and organization-qualified
    routes backed by the same view. Code Mode exposes the organization-qualified form,
    so omit only the duplicate legacy spelling.
    """
    enumerator = _CollectionSafeEndpointEnumerator()
    endpoints: dict[tuple[str, str], PublicGetEndpoint] = {}
    discovered = enumerator._get_api_endpoints(enumerator.patterns, "")
    for path, _path_regex, method, callback in discovered:
        view = callback.view_class
        status = view.publish_status.get(method)
        if (
            method != "GET"
            or not path.startswith("/api/0/")
            or path.startswith("/api/0/{var}/")
            or status is None
            or not status.is_published
        ):
            continue

        allowed_scopes: set[str] = set()
        for permission_class in view.permission_classes:
            scope_map = getattr(permission_class, "scope_map", {})
            allowed_scopes.update(scope_map.get(method, ()))

        silo_limit = getattr(view, "silo_limit", None)
        silo_modes: frozenset[SiloMode] = getattr(silo_limit, "modes", frozenset())
        silo_mode = (
            SiloMode.CONTROL
            if SiloMode.CONTROL in silo_modes and SiloMode.CELL not in silo_modes
            else None
        )
        endpoint = PublicGetEndpoint(path, view.__name__, frozenset(allowed_scopes), silo_mode)
        endpoints.setdefault((path, method), endpoint)
    assert endpoints, [
        (path, method, callback.view_class.__name__)
        for path, _path_regex, method, callback in discovered[:10]
    ]
    return tuple(sorted(endpoints.values(), key=lambda endpoint: endpoint.path_template))


PUBLIC_GET_ENDPOINTS = _public_get_endpoints()


def _public_mutation_endpoints() -> tuple[PublicMutationEndpoint, ...]:
    """Return every canonical public non-GET operation and its declared scopes."""
    enumerator = _CollectionSafeEndpointEnumerator()
    endpoints: dict[tuple[str, str], PublicMutationEndpoint] = {}
    discovered = enumerator._get_api_endpoints(enumerator.patterns, "")
    for path, _path_regex, method, callback in discovered:
        view = callback.view_class
        status = view.publish_status.get(method)
        if (
            method == "GET"
            or not path.startswith("/api/0/")
            or path.startswith("/api/0/{var}/")
            or status is None
            or not status.is_published
        ):
            continue

        allowed_scopes: set[str] = set()
        for permission_class in view.permission_classes:
            scope_map = getattr(permission_class, "scope_map", {})
            allowed_scopes.update(scope_map.get(method, ()))
        assert allowed_scopes, (path, method, view.__name__)

        silo_limit = getattr(view, "silo_limit", None)
        silo_modes: frozenset[SiloMode] = getattr(silo_limit, "modes", frozenset())
        silo_mode = (
            SiloMode.CONTROL
            if SiloMode.CONTROL in silo_modes and SiloMode.CELL not in silo_modes
            else None
        )
        endpoint = PublicMutationEndpoint(
            path,
            view.__name__,
            method,
            frozenset(allowed_scopes),
            silo_mode,
        )
        endpoints.setdefault((path, method), endpoint)
    assert endpoints
    return tuple(
        sorted(
            endpoints.values(),
            key=lambda endpoint: (endpoint.path_template, endpoint.method),
        )
    )


PUBLIC_MUTATION_ENDPOINTS = _public_mutation_endpoints()


# These are the private Sentry endpoints intentionally exposed as Code Mode helpers.
# Keep them explicit: unlike the public matrix, private API discovery would pull in
# implementation-only routes that Seer never calls.
PRIVATE_HELPER_GET_ENDPOINTS = (
    PublicGetEndpoint(
        "/api/0/issues/{issue_id}/tags/",
        GroupTagsEndpoint.__name__,
        _declared_scopes(GroupTagsEndpoint, "GET"),
        None,
    ),
)


USER_GLOBAL_GET_ENDPOINTS = (
    PublicGetEndpoint(
        "/api/0/users/me/organizations/",
        "UserOrganizationsEndpoint",
        frozenset(),
        SiloMode.CELL,
    ),
    PublicGetEndpoint(
        "/api/0/users/me/organization-integrations/",
        "UserOrganizationIntegrationsEndpoint",
        frozenset(),
        SiloMode.CONTROL,
    ),
    PublicGetEndpoint(
        "/api/0/users/me/user-identities/",
        "UserIdentityConfigEndpoint",
        frozenset(),
        SiloMode.CONTROL,
    ),
    PublicGetEndpoint(
        "/api/0/users/me/regions/",
        "UserRegionsEndpoint",
        frozenset(),
        SiloMode.CONTROL,
    ),
    PublicGetEndpoint(
        "/api/0/users/me/notification-options/",
        "UserNotificationSettingsOptionsEndpoint",
        frozenset(),
        SiloMode.CONTROL,
    ),
    PublicGetEndpoint(
        "/api/0/users/me/notification-providers/",
        "UserNotificationSettingsProvidersEndpoint",
        frozenset(),
        SiloMode.CONTROL,
    ),
    PublicGetEndpoint(
        "/api/0/users/me/notifications/email/",
        "UserNotificationEmailEndpoint",
        frozenset(),
        SiloMode.CONTROL,
    ),
    PublicGetEndpoint(
        "/api/0/users/me/identities/",
        "UserIdentityEndpoint",
        frozenset(),
        SiloMode.CONTROL,
    ),
    PublicGetEndpoint(
        "/api/0/users/me/",
        "UserDetailsEndpoint",
        frozenset(),
        SiloMode.CONTROL,
    ),
)


# Everything not listed here must return 200 for the real session user. SCIM routes
# intentionally require a SCIM integration credential instead of these authentication
# modes, but still must reach and reject at that credential boundary.
OUTER_BOUNDARY_GET_STATUSES = {
    "OrganizationSCIMMemberDetails": 403,
    "OrganizationSCIMMemberIndex": 403,
    "OrganizationSCIMResourceTypeDetails": 403,
    "OrganizationSCIMResourceTypeIndex": 403,
    "OrganizationSCIMSchemaDetails": 403,
    "OrganizationSCIMServiceProviderConfig": 403,
    "OrganizationSCIMTeamDetails": 403,
    "OrganizationSCIMTeamIndex": 403,
}


# These operations cannot produce a successful browser-user control without the
# credential, extension registration, or backing service named here. Every other
# mutation must really succeed.
OUTER_BOUNDARY_MUTATION_STATUSES = {
    ("NotificationActionsDetailsEndpoint", "PUT"): 400,
    ("NotificationActionsIndexEndpoint", "POST"): 400,
    ("OrganizationSCIMMemberDetails", "DELETE"): 403,
    ("OrganizationSCIMMemberDetails", "PATCH"): 403,
    ("OrganizationSCIMMemberIndex", "POST"): 403,
    ("OrganizationSCIMTeamDetails", "DELETE"): 403,
    ("OrganizationSCIMTeamDetails", "PATCH"): 403,
    ("OrganizationSCIMTeamIndex", "POST"): 403,
    ("ProjectPreprodSizeAnalysisSkipStatusCheckEndpoint", "POST"): 400,
    ("ProjectPreprodSnapshotSkipStatusCheckEndpoint", "POST"): 400,
}

AGENT_SUDO_BOUNDARY_MUTATIONS = frozenset({("TeamDetailsEndpoint", "DELETE")})


# Oracle: an owner token with the account's scopes. The account is linked to the project
# in an open-membership org, so it should reach everything the owner does. User-global
# routes must deny it, since it has no user.
SERVICE_ACCOUNT_SCOPES = frozenset(organization_roles.get("owner").scopes & GRANTABLE_SCOPES)


class ServiceAccountGap(StrEnum):
    CONTROL_SILO = "service account auth is cell-only"
    REQUIRES_USER = "rejects, or stores state for, an anonymous request.user"
    USER_ACTOR_ERROR = "500s using an anonymous request.user as an actor"
    NO_ORG_ROLE = "checks the caller's org role"


# Rows that don't match the oracle yet. Strict, so a fixed row fails until removed here.
SERVICE_ACCOUNT_KNOWN_GAPS: dict[str, ServiceAccountGap] = {
    "OrganizationIntegrationChannelValidate": ServiceAccountGap.CONTROL_SILO,
    "OrganizationIntegrationChannels": ServiceAccountGap.CONTROL_SILO,
    "OrganizationIntegrationDetails": ServiceAccountGap.CONTROL_SILO,
    "OrganizationIntegrationDetails_delete": ServiceAccountGap.CONTROL_SILO,
    "OrganizationIntegrations": ServiceAccountGap.CONTROL_SILO,
    "OrganizationSentryAppComponents": ServiceAccountGap.CONTROL_SILO,
    "OrganizationSentryApps": ServiceAccountGap.CONTROL_SILO,
    "SentryAppDetails": ServiceAccountGap.CONTROL_SILO,
    "SentryAppDetails_delete": ServiceAccountGap.CONTROL_SILO,
    "SentryAppDetails_put": ServiceAccountGap.CONTROL_SILO,
    "SentryAppInstallationExternalIssueActions_post": ServiceAccountGap.CONTROL_SILO,
    "SentryAppInstallationExternalRequests": ServiceAccountGap.CONTROL_SILO,
    "GroupIntegrationDetails": ServiceAccountGap.REQUIRES_USER,
    "GroupIntegrationDetails_post": ServiceAccountGap.REQUIRES_USER,
    "GroupIntegrationDetails_put": ServiceAccountGap.REQUIRES_USER,
    "OrganizationDashboards": ServiceAccountGap.REQUIRES_USER,
    "OrganizationDashboards_post": ServiceAccountGap.REQUIRES_USER,
    "OrganizationDetectorIndex": ServiceAccountGap.REQUIRES_USER,
    "OrganizationDetectorIndex_delete": ServiceAccountGap.REQUIRES_USER,
    "OrganizationDetectorIndex_put": ServiceAccountGap.REQUIRES_USER,
    "OrganizationGroupSearchViews": ServiceAccountGap.REQUIRES_USER,
    "OrganizationGroupSearchViews_post": ServiceAccountGap.REQUIRES_USER,
    "OrganizationMemberDetails": ServiceAccountGap.REQUIRES_USER,
    "OrganizationMemberDetails_delete": ServiceAccountGap.REQUIRES_USER,
    "OrganizationMemberDetails_put": ServiceAccountGap.REQUIRES_USER,
    "OrganizationMemberTeamDetails_delete": ServiceAccountGap.REQUIRES_USER,
    "OrganizationMemberTeamDetails_post": ServiceAccountGap.REQUIRES_USER,
    "OrganizationMemberTeamDetails_put": ServiceAccountGap.REQUIRES_USER,
    "OrganizationProjects_post": ServiceAccountGap.REQUIRES_USER,
    "OrganizationStarredServiceSpans_delete": ServiceAccountGap.REQUIRES_USER,
    "ProjectDetails_put": ServiceAccountGap.REQUIRES_USER,
    "OrganizationStarredServiceSpans_post": ServiceAccountGap.USER_ACTOR_ERROR,
    "ProjectDetails_delete": ServiceAccountGap.USER_ACTOR_ERROR,
    "TeamDetails_delete": ServiceAccountGap.USER_ACTOR_ERROR,
    "EventAttachmentDetails": ServiceAccountGap.NO_ORG_ROLE,
    "OrganizationMemberIndex_post": ServiceAccountGap.NO_ORG_ROLE,
}


def _matrix_cases() -> tuple[tuple[PublicGetEndpoint, MatrixAuthentication], ...]:
    cases: list[tuple[PublicGetEndpoint, MatrixAuthentication]] = []
    for endpoint in PUBLIC_GET_ENDPOINTS:
        for authentication in (
            MatrixAuthentication.SESSION,
            MatrixAuthentication.USER_TOKEN,
            MatrixAuthentication.VIEWER_CONTEXT,
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
            MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT,
        ):
            cases.append((endpoint, authentication))
    return tuple(cases)


def _mutation_matrix_cases() -> tuple[tuple[PublicMutationEndpoint, MatrixAuthentication], ...]:
    return tuple(
        (endpoint, authentication)
        for endpoint in PUBLIC_MUTATION_ENDPOINTS
        for authentication in MatrixAuthentication
    )


def _private_helper_get_matrix_cases() -> tuple[
    tuple[PublicGetEndpoint, MatrixAuthentication], ...
]:
    return tuple(
        (endpoint, authentication)
        for endpoint in PRIVATE_HELPER_GET_ENDPOINTS
        for authentication in (
            MatrixAuthentication.SESSION,
            MatrixAuthentication.USER_TOKEN,
            MatrixAuthentication.VIEWER_CONTEXT,
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
            MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT,
        )
    )


@override_settings(SEER_API_SHARED_SECRET=SECRET)
class OrganizationAgentTokenTest(APITestCase):
    endpoint = "sentry-api-0-organization-agent-token"

    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)

    def _mint(self, **data):
        return self.client.post(
            f"/api/0/organizations/{self.org.slug}/agent/token/", data=data, format="json"
        )

    def _assert_user_global_get_denied(self, endpoint: PublicGetEndpoint) -> None:
        self.login_as(self.owner)
        with self.feature(FLAG):
            bearer = self._mint(sessionId="user-global-boundary").data["token"]
            assert endpoint.silo_mode is not None
            with assume_test_silo_mode(endpoint.silo_mode):
                session_response = self.client.get(endpoint.path_template)
                agent_response = APIClient().get(
                    endpoint.path_template,
                    HTTP_AUTHORIZATION=f"Bearer {bearer}",
                )

        assert session_response.status_code == 200, session_response.content
        assert agent_response.status_code == 403, agent_response.content
        assert "insufficient_scope" not in agent_response.get("WWW-Authenticate", "")

    def _grant(self, *, organization=None, session_id="s1", scopes=("org:write",)):
        return self.create_seer_agent_write_grant(
            organization=organization or self.org,
            user=self.owner,
            session_id=session_id,
            scope_list=list(scopes),
        )

    def test_mint_defaults_to_readonly_and_default_writes(self) -> None:
        self.login_as(self.owner)
        with self.feature(FLAG):
            resp = self._mint(sessionId="s1")
        assert resp.status_code == 200, resp.content
        claims = agent_token.decode_agent_token(resp.data["token"])
        assert claims["ver"] == agent_token.AGENT_TOKEN_VERSION
        assert claims["sub"] == f"user:{self.owner.id}"
        assert claims["org"] == self.org.id
        assert claims["sid"] == "s1"
        assert "org:write" not in claims["scopes"]
        assert "event:write" not in claims["scopes"]
        assert "seer:write" in claims["scopes"]
        assert set(claims["scopes"]) <= (
            agent_token.readonly_scopes() | agent_token.AGENT_DEFAULT_WRITE_SCOPES
        )

    def test_feature_off_is_not_found(self) -> None:
        self.login_as(self.owner)
        assert self._mint(sessionId="s1").status_code == 404

    def test_session_id_required(self) -> None:
        self.login_as(self.owner)
        with self.feature(FLAG):
            assert self._mint().status_code == 400

    def test_non_object_body_rejected(self) -> None:
        self.login_as(self.owner)
        with self.feature(FLAG):
            response = self.client.post(
                f"/api/0/organizations/{self.org.slug}/agent/token/",
                data=["not", "an", "object"],
                format="json",
            )
        assert response.status_code == 400
        assert response.data == {"detail": "Request body must be an object."}

    def test_session_id_too_long_rejected(self) -> None:
        self.login_as(self.owner)
        with self.feature(FLAG):
            assert self._mint(sessionId="x" * 129).status_code == 400

    def test_requested_scopes_non_string_rejected(self) -> None:
        self.login_as(self.owner)
        with self.feature(FLAG):
            assert self._mint(sessionId="s1", requestedScopes=[{"a": 1}]).status_code == 400

    def test_identity_comes_from_request_not_body(self) -> None:
        # A foreign userId/org in the body must be ignored: the token is always minted
        # for the authenticated user.
        other = self.create_user()
        self.login_as(self.owner)
        with self.feature(FLAG):
            resp = self._mint(sessionId="s1", userId=other.id, org=999999)
        claims = agent_token.decode_agent_token(resp.data["token"])
        assert claims["sub"] == f"user:{self.owner.id}"
        assert claims["org"] == self.org.id

    def test_sentry_app_installation_token_cannot_mint(self) -> None:
        integration = self.create_internal_integration(
            organization=self.org,
            scopes=("org:read",),
        )
        token = self.create_internal_integration_token(
            user=self.owner,
            internal_integration=integration,
        )

        with self.feature(FLAG):
            response = self.client.post(
                f"/api/0/organizations/{self.org.slug}/agent/token/",
                data={"sessionId": "s1"},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
            )

        assert response.status_code == 403, response.content

    def test_approved_grant_is_folded_into_token(self) -> None:
        self._grant(session_id="s1", scopes=["org:write"])
        self.login_as(self.owner)
        with self.feature(FLAG):
            resp = self._mint(sessionId="s1")
        claims = agent_token.decode_agent_token(resp.data["token"])
        assert "org:write" in claims["scopes"]

    def test_oauth_caller_capped_by_token_scopes(self) -> None:
        # The owner has org:write by role and an approved grant for it, but the OAuth
        # token used to mint only carries org:read -> the minted token cannot exceed it.
        self._grant(session_id="s1", scopes=["org:write"])
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = self.create_user_auth_token(user=self.owner, scope_list=["org:read"])
        with self.feature(FLAG):
            resp = self.client.post(
                f"/api/0/organizations/{self.org.slug}/agent/token/",
                data={"sessionId": "s1"},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.plaintext_token}",
            )
        assert resp.status_code == 200, resp.content
        claims = agent_token.decode_agent_token(resp.data["token"])
        assert "org:write" not in claims["scopes"]

    def test_agent_token_cannot_mint(self) -> None:
        self.login_as(self.owner)
        with self.feature(FLAG):
            minted = self._mint(sessionId="s1")
        agent_bearer = minted.data["token"]
        with self.feature(FLAG):
            resp = self.client.post(
                f"/api/0/organizations/{self.org.slug}/agent/token/",
                data={"sessionId": "s2"},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {agent_bearer}",
            )
        assert resp.status_code == 403, resp.content

    @pytest.mark.seer_agent_token_matrix
    def test_end_to_end_denial_approval_remint_succeeds(self) -> None:
        # The complete state transition: a read-only JWT is denied, browser approval
        # persists a session grant, and only a newly minted JWT receives the write scope.
        self.login_as(self.owner)
        with self.feature(FLAG):
            initial_token = self._mint(sessionId="s1").data["token"]
            initial_claims = agent_token.decode_agent_token(initial_token)
            assert "org:write" not in initial_claims["scopes"]

            denied = self.client.put(
                f"/api/0/organizations/{self.org.slug}/",
                data={},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {initial_token}",
            )
            assert denied.status_code == 403, denied.content
            assert (
                denied["WWW-Authenticate"] == 'Bearer error="insufficient_scope", scope="org:write"'
            )

            approval = self.client.post(
                f"/api/0/organizations/{self.org.slug}/agent/approve/",
                data={"sessionId": "s1", "scopes": ["org:write"]},
                format="json",
            )
            assert approval.status_code == 200, approval.content

            original_token_still_denied = self.client.put(
                f"/api/0/organizations/{self.org.slug}/",
                data={},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {initial_token}",
            )
            assert original_token_still_denied.status_code == 403
            assert (
                original_token_still_denied["WWW-Authenticate"]
                == 'Bearer error="insufficient_scope", scope="org:write"'
            )

            elevated_token = self._mint(sessionId="s1").data["token"]
            elevated_claims = agent_token.decode_agent_token(elevated_token)
            assert elevated_token != initial_token
            assert "org:write" in elevated_claims["scopes"]

            write = self.client.put(
                f"/api/0/organizations/{self.org.slug}/",
                data={},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {elevated_token}",
            )
        assert write.status_code == 200

    def test_token_is_rejected_against_a_different_org(self) -> None:
        # A token minted for org A (carrying an org:write granted for A) must not be
        # honored against org B, even though the same user is also an owner of B.
        other_org = self.create_organization(owner=self.owner)
        self._grant(session_id="s1", scopes=["org:write"])
        self.login_as(self.owner)
        with self.feature(FLAG):
            token = self._mint(sessionId="s1").data["token"]
            write = self.client.put(
                f"/api/0/organizations/{other_org.slug}/",
                data={},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token}",
            )
        assert write.status_code == 403

    @pytest.mark.seer_agent_token_matrix
    def test_agent_token_cannot_create_an_organization(self) -> None:
        self.login_as(self.owner)

        with self.feature(FLAG):
            readonly_token = self._mint(sessionId="s1").data["token"]
            with assume_test_silo_mode(SiloMode.CONTROL):
                readonly_response = APIClient().post(
                    "/api/0/organizations/",
                    data={"name": "Outside Token Organization"},
                    format="json",
                    HTTP_AUTHORIZATION=f"Bearer {readonly_token}",
                )

            self._grant(session_id="s1", scopes=["org:write"])
            approved_token = self._mint(sessionId="s1").data["token"]
            with assume_test_silo_mode(SiloMode.CONTROL):
                approved_response = APIClient().post(
                    "/api/0/organizations/",
                    data={"name": "Outside Token Organization"},
                    format="json",
                    HTTP_AUTHORIZATION=f"Bearer {approved_token}",
                )

        for response in (readonly_response, approved_response):
            assert response.status_code == 403
            assert "insufficient_scope" not in response.get("WWW-Authenticate", "")

    def _assert_agent_token_cannot_use_user_account_or_relocation_workflows(
        self, authentication: MatrixAuthentication
    ) -> None:
        assert authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
            MatrixAuthentication.APPROVED_AGENT_TOKEN,
        }
        self.login_as(self.owner)

        with self.feature(FLAG):
            session_id = f"disallowed-workflows-{authentication.value}"
            mint_payload: dict[str, Any] = {"sessionId": session_id}
            if authentication is MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN:
                mint_payload["requestedScopes"] = []
            elif authentication is MatrixAuthentication.APPROVED_AGENT_TOKEN:
                approval = self.client.post(
                    f"/api/0/organizations/{self.org.slug}/agent/approve/",
                    data={"sessionId": session_id, "scopes": ["org:write"]},
                    format="json",
                )
                assert approval.status_code == 200, approval.content

            token = self._mint(**mint_payload).data["token"]
            scopes = set(agent_token.decode_agent_token(token)["scopes"])
            if authentication is MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN:
                assert not scopes
            elif authentication is MatrixAuthentication.APPROVED_AGENT_TOKEN:
                assert "org:write" in scopes
            else:
                assert "org:write" not in scopes

            client = APIClient()
            responses = {
                "list relocations": client.get(
                    "/api/0/relocations/",
                    HTTP_AUTHORIZATION=f"Bearer {token}",
                ),
                "start relocation": client.post(
                    "/api/0/relocations/",
                    data={},
                    format="json",
                    HTTP_AUTHORIZATION=f"Bearer {token}",
                ),
                "retry relocation": client.post(
                    "/api/0/relocations/00000000-0000-0000-0000-000000000000/retry/",
                    data={},
                    format="json",
                    HTTP_AUTHORIZATION=f"Bearer {token}",
                ),
            }
            with assume_test_silo_mode(SiloMode.CONTROL):
                responses["generate user merge code"] = client.post(
                    "/api/0/auth-v2/user-merge-verification-codes/",
                    data={},
                    format="json",
                    HTTP_AUTHORIZATION=f"Bearer {token}",
                )

        for endpoint, response in responses.items():
            with self.subTest(endpoint=endpoint):
                assert response.status_code == 403, response.content
                assert "insufficient_scope" not in response.get("WWW-Authenticate", "")

    def test_organization_owner_listing_remains_token_org_bound(self) -> None:
        other_org = self.create_organization(owner=self.owner)
        self.login_as(self.owner)

        with self.feature(FLAG):
            token = self._mint(sessionId="s1").data["token"]
            for silo_mode in (SiloMode.CELL, SiloMode.CONTROL):
                with self.subTest(silo_mode=silo_mode.value):
                    with assume_test_silo_mode(silo_mode):
                        response = APIClient().get(
                            "/api/0/organizations/?owner=1",
                            HTTP_AUTHORIZATION=f"Bearer {token}",
                        )

                    assert response.status_code == 200, response.content
                    listed_ids = {int(item["organization"]["id"]) for item in response.data}
                    assert listed_ids == {self.org.id}
                    assert other_org.id not in listed_ids

    def test_project_listings_retain_agent_org_and_member_bounds(self) -> None:
        self.org.flags.allow_joinleave = False
        self.org.save()
        member_team = self.create_team(organization=self.org)
        member_project = self.create_project(organization=self.org, teams=[member_team])
        other_team = self.create_team(organization=self.org)
        self.create_project(organization=self.org, teams=[other_team])

        other_org = self.create_organization()
        cross_org_team = self.create_team(organization=other_org)
        self.create_project(organization=other_org, teams=[cross_org_team])

        member_user = self.create_user()
        self.create_member(
            user=member_user,
            organization=self.org,
            role="member",
            teams=[member_team],
        )
        self.create_member(
            user=member_user,
            organization=other_org,
            role="member",
            teams=[cross_org_team],
        )
        self.login_as(member_user)

        with self.feature(FLAG):
            token = self._mint(sessionId="s1").data["token"]
            client = APIClient()
            responses = {
                "global": client.get(
                    "/api/0/projects/",
                    HTTP_AUTHORIZATION=f"Bearer {token}",
                ),
                "organization": client.get(
                    f"/api/0/organizations/{self.org.slug}/projects/",
                    HTTP_AUTHORIZATION=f"Bearer {token}",
                ),
            }

        for surface, response in responses.items():
            with self.subTest(surface=surface):
                assert response.status_code == 200, response.content
                assert {int(item["id"]) for item in response.data} == {member_project.id}

    def test_owner_agent_project_listing_is_org_bound(self) -> None:
        self.org.flags.allow_joinleave = False
        self.org.save()
        unjoined_team = self.create_team(organization=self.org)
        unjoined_project = self.create_project(organization=self.org, teams=[unjoined_team])

        other_org = self.create_organization(owner=self.owner)
        other_project = self.create_project(organization=other_org)
        self.login_as(self.owner)

        with self.feature(FLAG):
            token = self._mint(sessionId="s1").data["token"]
            response = APIClient().get(
                "/api/0/projects/",
                HTTP_AUTHORIZATION=f"Bearer {token}",
            )

        assert response.status_code == 200, response.content
        listed_ids = {int(item["id"]) for item in response.data}
        assert listed_ids == {unjoined_project.id}
        assert other_project.id not in listed_ids

    def test_end_to_end_read_allowed_write_denied(self) -> None:
        # Mint via session, then use the minted token as a bearer: read passes; an
        # under-scoped write is denied with the RFC 6750 insufficient_scope challenge naming
        # the required scopes, and persists nothing.
        self.login_as(self.owner)
        with self.feature(FLAG):
            token = self._mint(sessionId="s1").data["token"]
            details_url = f"/api/0/organizations/{self.org.slug}/"
            read = self.client.get(details_url, HTTP_AUTHORIZATION=f"Bearer {token}")
            assert read.status_code == 200

            write = self.client.put(
                details_url, data={}, format="json", HTTP_AUTHORIZATION=f"Bearer {token}"
            )
        assert write.status_code == 403
        assert write["WWW-Authenticate"] == 'Bearer error="insufficient_scope", scope="org:write"'
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()


def _install_disallowed_agent_token_boundary_matrix_tests() -> None:
    for authentication in (
        MatrixAuthentication.AGENT_TOKEN,
        MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
        MatrixAuthentication.APPROVED_AGENT_TOKEN,
    ):

        def test_matrix_cell(
            self: OrganizationAgentTokenTest,
            authentication: MatrixAuthentication = authentication,
        ) -> None:
            self._assert_agent_token_cannot_use_user_account_or_relocation_workflows(authentication)

        test_matrix_cell.__name__ = f"test_disallowed_agent_token_workflows_{authentication.value}"
        test_matrix_cell = pytest.mark.seer_agent_token_matrix(test_matrix_cell)
        setattr(OrganizationAgentTokenTest, test_matrix_cell.__name__, test_matrix_cell)


_install_disallowed_agent_token_boundary_matrix_tests()


def _install_user_global_boundary_matrix_tests() -> None:
    for index, endpoint in enumerate(USER_GLOBAL_GET_ENDPOINTS):

        def test_matrix_cell(
            self: OrganizationAgentTokenTest,
            endpoint: PublicGetEndpoint = endpoint,
        ) -> None:
            self._assert_user_global_get_denied(endpoint)

        test_matrix_cell.__name__ = (
            f"test_user_global_get_{index:03d}_{endpoint.test_id}_agent_token"
        )
        test_matrix_cell = pytest.mark.seer_agent_token_matrix(test_matrix_cell)
        setattr(OrganizationAgentTokenTest, test_matrix_cell.__name__, test_matrix_cell)


_install_user_global_boundary_matrix_tests()
