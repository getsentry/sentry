from __future__ import annotations

import re
from contextlib import nullcontext
from dataclasses import dataclass
from datetime import timedelta
from enum import StrEnum
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch
from urllib.parse import urlencode
from uuid import uuid4

import pytest
import requests
from django.conf import settings
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.http import HttpResponse
from django.test import override_settings
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIClient

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.endpoints.seer_models import SEER_MODELS_CACHE_KEY
from sentry.apidocs.hooks import CustomEndpointEnumerator
from sentry.attachments.base import CachedAttachment
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.subscription_limits import METRIC_SUBSCRIPTION_FEATURE_FLAGS
from sentry.models.eventattachment import EventAttachment
from sentry.models.organizationmember import OrganizationMember
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay, mock_replay_viewed
from sentry.seer import agent_token
from sentry.seer.models.agent_write_grant import SeerAgentWriteGrant
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"
FLAG = "organizations:seer-agent-token-flow"


class MatrixAuthentication(StrEnum):
    SESSION = "session"
    USER_TOKEN = "user_token"
    VIEWER_CONTEXT = "viewer_context"
    AGENT_TOKEN = "agent_token"
    SCOPED_DOWN_AGENT_TOKEN = "scoped_down_agent_token"
    APPROVED_AGENT_TOKEN = "approved_agent_token"


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
        if (
            method != "GET"
            or not path.startswith("/api/0/")
            or path.startswith("/api/0/{var}/")
            or view.publish_status.get(method) is not ApiPublishStatus.PUBLIC
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
        if (
            method == "GET"
            or not path.startswith("/api/0/")
            or path.startswith("/api/0/{var}/")
            or view.publish_status.get(method) is not ApiPublishStatus.PUBLIC
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


# Everything not listed here must return 200 for the real session user. SCIM routes
# intentionally require a SCIM integration credential instead of these authentication
# modes, but still must reach and reject at that credential boundary.
OUTER_BOUNDARY_GET_STATUSES = {
    "OrganizationSCIMMemberDetails": 403,
    "OrganizationSCIMMemberIndex": 403,
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


def _matrix_cases() -> tuple[tuple[PublicGetEndpoint, MatrixAuthentication], ...]:
    cases: list[tuple[PublicGetEndpoint, MatrixAuthentication]] = []
    for endpoint in PUBLIC_GET_ENDPOINTS:
        for authentication in (
            MatrixAuthentication.SESSION,
            MatrixAuthentication.USER_TOKEN,
            MatrixAuthentication.VIEWER_CONTEXT,
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
        ):
            cases.append((endpoint, authentication))
    return tuple(cases)


def _mutation_matrix_cases() -> tuple[tuple[PublicMutationEndpoint, MatrixAuthentication], ...]:
    return tuple(
        (endpoint, authentication)
        for endpoint in PUBLIC_MUTATION_ENDPOINTS
        for authentication in MatrixAuthentication
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

    def _grant(self, *, organization=None, session_id="s1", scopes=("org:write",)):
        return self.create_seer_agent_write_grant(
            organization=organization or self.org,
            user=self.owner,
            session_id=session_id,
            scope_list=list(scopes),
        )

    def test_mint_defaults_to_readonly(self) -> None:
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
        assert set(claims["scopes"]) <= agent_token.readonly_scopes()

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

    def test_agent_token_cannot_use_user_account_or_relocation_workflows(self) -> None:
        self.login_as(self.owner)

        with self.feature(FLAG):
            token = self._mint(sessionId="s1").data["token"]
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


@pytest.mark.sentry_metrics
@pytest.mark.seer_agent_token_matrix
@requires_snuba
@override_settings(SEER_API_SHARED_SECRET=SECRET)
class AgentTokenPublicGetMatrixTest(APITestCase):
    """Differential, full-stack authentication coverage for the public API.

    Every row uses a real database user, organization membership, team, and project.
    Session responses validate the fixture and are the oracle for full-authority user
    tokens and ViewerContext. An agent response is compared with a real user token minted
    for the same user with exactly the same scopes. This deliberately treats each
    endpoint's current scope behavior as the contract, without asserting that its scope
    map is correct. Any difference therefore isolates agent-token compatibility or a
    scope escape rather than a pre-existing endpoint scope problem. A zero-scope token
    exercises explicit mint-time narrowing against every operation.

    Endpoint-specific tests remain responsible for response payload semantics; this
    matrix is the source of truth for authentication and permission outcomes.

    Run the complete matrix with ``-m seer_agent_token_matrix`` or select one
    authentication mode with its ``seer_matrix_*`` marker.
    """

    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.member = OrganizationMember.objects.get(organization=self.org, user_id=self.owner.id)
        self.create_team_membership(team=self.team, member=self.member)

        # Fixture helpers conventionally read these attributes.
        self.user = self.owner
        self.organization = self.org
        self._matrix_resources: dict[str, Any] = {}
        self.login_as(self.owner)

    def _resource(self, name: str) -> Any:
        if name in self._matrix_resources:
            return self._matrix_resources[name]

        if name == "dashboard":
            resource = self.create_dashboard(organization=self.org, created_by=self.owner)
        elif name == "detector":
            resource = self.create_detector(project=self.project)
        elif name == "mutable_detector":
            resource = self.create_detector(project=self.project, type="metric_issue")
        elif name == "environment":
            resource = self.create_environment(project=self.project, name="production")
        elif name == "event":
            resource = self.store_event(
                data={
                    "event_id": uuid4().hex,
                    "environment": self._resource("environment").name,
                    "exception": {"values": []},
                    "message": "permission matrix event",
                    "platform": "javascript",
                    "timestamp": timezone.now().isoformat(),
                },
                project_id=self.project.id,
            )
        elif name == "event_attachment":
            event = self._resource("event")
            cached_attachment = CachedAttachment(
                name="permission-matrix.txt",
                content_type="text/plain",
                data=b"permission matrix attachment",
            )
            attachment_file = EventAttachment.putfile(self.project.id, cached_attachment)
            resource = EventAttachment.objects.create(
                event_id=event.event_id,
                project_id=self.project.id,
                group_id=event.group_id,
                type=cached_attachment.type,
                name=cached_attachment.name,
                content_type=attachment_file.content_type,
                size=attachment_file.size,
                sha1=attachment_file.sha1,
                blob_path=attachment_file.blob_path,
            )
        elif name == "group":
            resource = self._resource("event").group
        elif name == "integration":
            resource = self.create_integration(
                organization=self.org,
                external_id=f"matrix-{uuid4()}",
                provider="example",
                name="Matrix integration",
            )
        elif name == "codeowners_integration":
            resource = self.create_integration(
                organization=self.org,
                external_id=f"matrix-github-{uuid4()}",
                provider="github",
                name="Matrix GitHub integration",
            )
        elif name == "data_forwarder":
            resource = self.create_data_forwarder(
                organization=self.org,
                provider="segment",
                config={"write_key": "matrix-key"},
            )
        elif name == "detector_condition_group":
            resource = self.create_data_condition_group(organization_id=self.org.id)
        elif name == "external_team":
            resource = self.create_external_team(
                team=self.team,
                integration=self._resource("codeowners_integration"),
            )
        elif name == "external_user":
            resource = self.create_external_user(
                user=self.owner,
                organization=self.org,
                integration=self._resource("codeowners_integration"),
                external_name="@permission-matrix",
            )
        elif name == "external_issue":
            with self.feature("organizations:integrations-issue-basic"):
                response = self.client.put(
                    f"/api/0/organizations/{self.org.slug}/issues/"
                    f"{self._resource('group').id}/integrations/"
                    f"{self._resource('integration').id}/",
                    data={"externalIssue": "MATRIX-123"},
                    format="json",
                )
            assert response.status_code == 201, response.content
            resource = response.data
        elif name == "monitor":
            resource = self.create_monitor(project=self.project, organization=self.org)
        elif name == "notification_action":
            resource = self.create_notification_action(
                organization=self.org, projects=[self.project]
            )
        elif name == "preprod_artifact":
            resource = self.create_preprod_artifact(project=self.project)
        elif name == "preprod_snapshot":
            response = self.client.post(
                f"/api/0/projects/{self.org.slug}/{self.project.slug}/preprodartifacts/snapshots/",
                data={
                    "app_id": "com.example.permission-matrix-resource",
                    "images": {
                        "permission-matrix.png": {
                            "content_hash": "permission-matrix-image",
                            "display_name": "Permission Matrix",
                            "width": 100,
                            "height": 100,
                        }
                    },
                },
                format="json",
            )
            assert response.status_code == 200, response.content
            resource = response.data
        elif name == "project_key":
            resource = self.create_project_key(project=self.project)
        elif name == "release":
            resource = self.create_release(project=self.project, user=self.owner)
        elif name == "release_file":
            resource = self.create_release_file(
                release_id=self._resource("release").id,
                file=self.create_file(name="matrix.js", type="release.file"),
            )
        elif name == "replay":
            replay_id = uuid4().hex
            self._store_replay(
                mock_replay(
                    timezone.now() - timedelta(seconds=10),
                    self.project.id,
                    replay_id,
                )
            )
            self._store_replay(
                mock_replay_viewed(
                    timezone.now().timestamp(),
                    self.project.id,
                    replay_id,
                    self.owner.id,
                )
            )
            resource = replay_id
        elif name == "replay_deletion_job":
            now = timezone.now()
            resource = self.create_replay_deletion_job(
                project=self.project,
                range_start=now - timedelta(days=2),
                range_end=now - timedelta(days=1),
                query="",
                environments=["production"],
                status="in-progress",
            )
        elif name == "replay_recording_segment":
            metadata = RecordingSegmentStorageMeta(
                project_id=self.project.id,
                replay_id=self._resource("replay"),
                segment_id=0,
                retention_days=None,
            )
            FilestoreBlob().set(metadata, b'[{"type": 5, "data": {}}]')
            resource = metadata
        elif name == "repository":
            resource = self.create_repo(project=self.project)
        elif name == "secondary_member":
            secondary_user = self.create_user()
            resource = self.create_member(
                organization=self.org,
                user=secondary_user,
                role="member",
            )
            self.create_team_membership(team=self.team, member=resource)
        elif name == "saved_query":
            with self.feature("organizations:discover-query"):
                response = self.client.post(
                    f"/api/0/organizations/{self.org.slug}/discover/saved/",
                    data={
                        "name": "Permission matrix query",
                        "projects": [self.project.id],
                        "queryDataset": "error-events",
                        "fields": ["title"],
                        "query": "is:unresolved",
                        "version": 2,
                    },
                    format="json",
                )
            assert response.status_code == 201, response.content
            resource = response.data
        elif name == "sentry_app":
            resource = self.create_sentry_app(
                name=f"matrix-{uuid4()}", organization=self.org, published=True
            )
        elif name == "mutable_sentry_app":
            resource = self.create_sentry_app(
                name=f"matrix-mutable-{uuid4()}",
                organization=self.org,
                published=False,
            )
        elif name == "service_hook":
            resource = self.create_service_hook(
                actor=self.owner, org=self.org, project=self.project
            )
        elif name == "symbol_source":
            resource = {
                "id": "permission-matrix-source",
                "name": "Permission matrix source",
                "layout": {"type": "native"},
                "type": "http",
                "url": "https://symbols.example.com",
                "username": "matrix",
                "password": "matrix-password",
            }
            self.project.update_option("sentry:symbol_sources", json.dumps([resource]))
        elif name == "workflow":
            resource = self.create_workflow(organization=self.org)
        else:
            raise AssertionError(f"unknown matrix resource {name!r}")

        self._matrix_resources[name] = resource
        return resource

    def _store_replay(self, replay: dict[str, Any]) -> None:
        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/replays/insert",
            json=[replay],
            timeout=30,
        )
        assert response.status_code == 200, response.content

    def _path_value(
        self,
        placeholder: str,
        endpoint: PublicGetEndpoint | PublicMutationEndpoint,
    ) -> str:
        path_template = endpoint.path_template
        if placeholder == "var":
            return "issues"
        if placeholder == "organization_id_or_slug":
            return self.org.slug
        if placeholder == "project_id_or_slug":
            return self.project.slug
        if placeholder == "team_id_or_slug":
            if endpoint.endpoint_name == "OrganizationSCIMTeamDetails":
                return str(self.team.id)
            return self.team.slug
        if placeholder == "member_id":
            member = (
                self._resource("secondary_member")
                if isinstance(endpoint, PublicMutationEndpoint)
                else self.member
            )
            return str(member.id)
        if placeholder == "attachment_id":
            return str(self._resource("event_attachment").id)
        if placeholder == "dashboard_id":
            return str(self._resource("dashboard").id)
        if placeholder == "detector_id":
            detector = (
                self._resource("mutable_detector")
                if isinstance(endpoint, PublicMutationEndpoint)
                else self._resource("detector")
            )
            return str(detector.id)
        if placeholder == "environment":
            return self._resource("environment").name
        if placeholder == "issue_id":
            return str(self._resource("group").id)
        if placeholder == "integration_id":
            return str(self._resource("integration").id)
        if placeholder == "data_forwarder_id":
            return str(self._resource("data_forwarder").id)
        if placeholder == "external_team_id":
            return str(self._resource("external_team").id)
        if placeholder == "external_user_id":
            return str(self._resource("external_user").id)
        if placeholder == "monitor_id_or_slug":
            return str(self._resource("monitor").guid)
        if placeholder == "action_id":
            return str(self._resource("notification_action").id)
        if placeholder == "artifact_id":
            return str(self._resource("preprod_artifact").id)
        if placeholder == "key_id":
            return self._resource("project_key").public_key
        if placeholder == "version":
            return self._resource("release").version
        if placeholder == "file_id":
            return str(self._resource("release_file").id)
        if placeholder == "repo_id":
            return str(self._resource("repository").id)
        if placeholder == "sentry_app_id_or_slug":
            sentry_app = (
                self._resource("mutable_sentry_app")
                if isinstance(endpoint, PublicMutationEndpoint)
                else self._resource("sentry_app")
            )
            return str(sentry_app.id)
        if placeholder == "hook_id":
            return str(self._resource("service_hook").id)
        if placeholder == "workflow_id":
            return str(self._resource("workflow").id)
        if placeholder == "key":
            return "environment"
        if placeholder == "filter_id":
            return "browser-extensions"
        if placeholder == "event_id":
            return self._resource("event").event_id
        if placeholder == "job_id":
            return str(self._resource("replay_deletion_job").id)
        if placeholder == "query_id":
            return str(self._resource("saved_query")["id"])
        if placeholder == "replay_id":
            return self._resource("replay")
        if placeholder == "segment_id":
            self._resource("replay_recording_segment")
            return "0"
        if placeholder == "snapshot_id" and endpoint.endpoint_name in {
            "OrganizationPreprodSnapshotEndpoint",
            "OrganizationPreprodSnapshotImageDetailEndpoint",
        }:
            return str(self._resource("preprod_snapshot")["artifactId"])
        if placeholder == "image_identifier":
            self._resource("preprod_snapshot")
            return "permission-matrix.png"

        # These resources live in external storage or require a specialized service.
        # A well-formed nonexistent identifier still exercises authentication, endpoint
        # scopes, URL conversion, and the outer resource permission boundary.
        opaque_values = {
            "external_issue_id": "1",
            "profile_id": uuid4().hex,
            "snapshot_id": "1",
            "trace_id": uuid4().hex,
        }
        if placeholder in opaque_values:
            return opaque_values[placeholder]
        raise AssertionError(
            f"{path_template} introduced unsupported path placeholder {placeholder!r}"
        )

    def _path(self, endpoint: PublicGetEndpoint | PublicMutationEndpoint) -> str:
        path = endpoint.path_template
        for placeholder in re.findall(r"{([^}]+)}", path):
            path = path.replace("{" + placeholder + "}", self._path_value(placeholder, endpoint))
        query_params = self._query_params(endpoint)
        if query_params:
            path = f"{path}?{urlencode(query_params, doseq=True)}"
        return path

    def _query_params(self, endpoint: PublicGetEndpoint | PublicMutationEndpoint) -> dict[str, Any]:
        if endpoint.endpoint_name == "OrganizationEventsEndpoint":
            return {
                "field": ["id", "project"],
                "project": [self.project.id],
                "statsPeriod": "1h",
            }
        if endpoint.endpoint_name == "OrganizationPreprodLatestBaseSnapshotEndpoint":
            self._resource("preprod_snapshot")
            return {"app_id": "com.example.permission-matrix-resource"}
        if endpoint.endpoint_name == "OrganizationProfilingChunksEndpoint":
            return {
                "profiler_id": uuid4().hex,
                "project": [self.project.id],
                "statsPeriod": "1h",
            }
        if endpoint.endpoint_name == "OrganizationProfilingFlamegraphEndpoint":
            return {"project": [self.project.id], "statsPeriod": "1h"}
        if endpoint.endpoint_name == "ReleaseThresholdStatusIndexEndpoint":
            now = timezone.now()
            return {
                "start": (now - timedelta(hours=1)).isoformat(),
                "end": now.isoformat(),
            }
        if endpoint.endpoint_name == "OrganizationSessionsEndpoint":
            return {
                "field": ["sum(session)"],
                "project": [self.project.id],
                "statsPeriod": "1h",
            }
        if endpoint.endpoint_name in {
            "OrganizationStatsSummaryEndpoint",
            "OrganizationStatsEndpointV2",
        }:
            params: dict[str, Any] = {
                "field": ["sum(quantity)"],
                "project": [self.project.id],
                "statsPeriod": "1h",
                "interval": "1h",
            }
            if endpoint.endpoint_name == "OrganizationStatsEndpointV2":
                params["category"] = "error"
            return params
        if endpoint.endpoint_name == "OrganizationTraceItemAttributesEndpoint":
            return {"dataset": "spans", "project": [self.project.id]}
        if endpoint.endpoint_name == "OrganizationTraceItemStatsEndpoint":
            return {
                "statsType": ["attributeDistributions"],
                "itemType": "spans",
                "project": [self.project.id],
            }
        if endpoint.endpoint_name == "OrganizationDetectorIndexEndpoint" and isinstance(
            endpoint, PublicMutationEndpoint
        ):
            return {"id": [self._resource("mutable_detector").id]}
        if endpoint.endpoint_name == "OrganizationWorkflowIndexEndpoint" and isinstance(
            endpoint, PublicMutationEndpoint
        ):
            return {"id": [self._resource("workflow").id]}
        if (
            endpoint.endpoint_name == "GroupIntegrationDetailsEndpoint"
            and isinstance(endpoint, PublicMutationEndpoint)
            and endpoint.method == "DELETE"
        ):
            return {"externalIssue": self._resource("external_issue")["id"]}
        if endpoint.endpoint_name == "GroupIntegrationDetailsEndpoint":
            return {"action": "link"}
        if (
            endpoint.endpoint_name == "ProjectSymbolSourcesEndpoint"
            and isinstance(endpoint, PublicMutationEndpoint)
            and endpoint.method in {"DELETE", "PUT"}
        ):
            return {"id": self._resource("symbol_source")["id"]}
        if endpoint.endpoint_name == "ProjectPreprodBuildDistributionLatestEndpoint":
            return {"appId": "com.example.matrix", "platform": "apple"}
        return {}

    def _feature_flags(
        self, endpoint: PublicGetEndpoint | PublicMutationEndpoint
    ) -> dict[str, bool]:
        flags = {FLAG: True}
        endpoint_flags = {
            "DataForwardingDetailsEndpoint": "organizations:data-forwarding",
            "DataForwardingIndexEndpoint": "organizations:data-forwarding",
            "DiscoverSavedQueryDetailEndpoint": "organizations:discover-query",
            "DiscoverSavedQueriesEndpoint": "organizations:discover-query",
            "ExternalTeamDetailsEndpoint": "organizations:integrations-codeowners",
            "ExternalTeamEndpoint": "organizations:integrations-codeowners",
            "ExternalUserDetailsEndpoint": "organizations:integrations-codeowners",
            "ExternalUserEndpoint": "organizations:integrations-codeowners",
            "EventAttachmentDetailsEndpoint": "organizations:event-attachments",
            "GroupAutofixEndpoint": "organizations:gen-ai-features",
            "GroupIntegrationDetailsEndpoint": "organizations:integrations-issue-basic",
            "OrganizationEventsEndpoint": "organizations:discover-basic",
            "OrganizationProfilingChunksEndpoint": "organizations:continuous-profiling",
            "OrganizationProfilingFlamegraphEndpoint": "organizations:profiling",
            "OrganizationTraceItemAttributesEndpoint": "organizations:visibility-explore-view",
            "ProjectProfilingProfileEndpoint": "organizations:profiling",
        }
        if feature := endpoint_flags.get(endpoint.endpoint_name):
            flags[feature] = True
        if endpoint.endpoint_name == "OrganizationProjectDetectorIndexEndpoint":
            flags.update(METRIC_SUBSCRIPTION_FEATURE_FLAGS)
        if "Replay" in endpoint.endpoint_name:
            flags["organizations:session-replay"] = True
        return flags

    def _mint_agent_token(
        self,
        *,
        approved_scopes: frozenset[str] = frozenset(),
        requested_scopes: frozenset[str] | None = None,
    ) -> str:
        if approved_scopes:
            approval = self.client.post(
                f"/api/0/organizations/{self.org.slug}/agent/approve/",
                data={
                    "sessionId": "permission-matrix",
                    "scopes": sorted(approved_scopes),
                },
                format="json",
            )
            assert approval.status_code == 200, approval.content
            assert approved_scopes <= set(approval.data["scopes"]), approval.data
        payload: dict[str, Any] = {"sessionId": "permission-matrix"}
        if requested_scopes is not None:
            payload["requestedScopes"] = sorted(requested_scopes)
        response = self.client.post(
            f"/api/0/organizations/{self.org.slug}/agent/token/",
            data=payload,
            format="json",
        )
        assert response.status_code == 200, response.content
        assert approved_scopes <= set(response.data["scopes"]), response.data
        if requested_scopes is not None:
            assert set(response.data["scopes"]) <= requested_scopes, response.data
        return response.data["token"]

    def _mutation_payload(self, endpoint: PublicMutationEndpoint) -> dict[str, Any]:
        key = (endpoint.endpoint_name, endpoint.method)
        payloads: dict[tuple[str, str], dict[str, Any]] = {
            ("DataForwardingDetailsEndpoint", "PUT"): {
                "provider": "segment",
                "config": {"write_key": "updated-matrix-key"},
                "project_ids": [self.project.id],
            },
            ("DataForwardingIndexEndpoint", "POST"): {
                "provider": "sqs",
                "config": {
                    "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/matrix",
                    "region": "us-east-1",
                    "access_key": "matrix-access-key",
                    "secret_key": "matrix-secret-key",
                },
                "project_ids": [],
            },
            ("DiscoverSavedQueriesEndpoint", "POST"): {
                "name": "Permission matrix query mutation",
                "projects": [self.project.id],
                "queryDataset": "error-events",
                "fields": ["title"],
                "query": "is:unresolved",
                "version": 2,
            },
            ("DiscoverSavedQueryDetailEndpoint", "PUT"): {
                "name": "Updated permission matrix query",
                "projects": [self.project.id],
                "queryDataset": "error-events",
                "fields": ["title"],
                "query": "is:resolved",
                "version": 2,
            },
            ("ExternalTeamDetailsEndpoint", "PUT"): {"externalName": "@permission-matrix-updated"},
            ("ExternalTeamEndpoint", "POST"): {
                "externalName": "@permission-matrix-new",
                "provider": "github",
                "integrationId": self._resource("codeowners_integration").id,
            },
            ("ExternalUserDetailsEndpoint", "PUT"): {"externalName": "@permission-matrix-updated"},
            ("ExternalUserEndpoint", "POST"): {
                "externalName": "@permission-matrix-new",
                "provider": "github",
                "userId": self.owner.id,
                "integrationId": self._resource("codeowners_integration").id,
            },
            ("OrganizationDashboardDetailsEndpoint", "PUT"): {
                "title": "Updated permission matrix dashboard"
            },
            ("OrganizationDashboardsEndpoint", "POST"): {
                "title": "Permission matrix dashboard mutation"
            },
            ("OrganizationDetailsEndpoint", "PUT"): {"name": self.org.name},
            ("OrganizationDetectorIndexEndpoint", "PUT"): {"enabled": False},
            ("OrganizationReleaseFileDetailsEndpoint", "PUT"): {"name": "updated-matrix.js"},
            ("ProjectReleaseFileDetailsEndpoint", "PUT"): {"name": "updated-matrix.js"},
            ("ProjectReleaseFilesEndpoint", "POST"): {
                "name": "https://example.com/permission-matrix.js"
            },
            ("GroupIntegrationDetailsEndpoint", "POST"): {"assignee": "matrix@example.com"},
            ("GroupIntegrationDetailsEndpoint", "PUT"): {"externalIssue": "MATRIX-456"},
            ("OrganizationMemberDetailsEndpoint", "PUT"): {"role": "manager"},
            ("OrganizationMemberIndexEndpoint", "POST"): {
                "email": f"matrix-{uuid4()}@example.com",
                "role": "member",
            },
            ("OrganizationProjectsEndpoint", "POST"): {
                "name": "Permission Matrix Project",
                "team": self.team.slug,
            },
            ("OrganizationProjectDetectorIndexEndpoint", "POST"): {
                "name": "Permission Matrix Detector",
                "type": "metric_issue",
                "dataSources": [
                    {
                        "queryType": SnubaQuery.Type.ERROR.value,
                        "dataset": Dataset.Events.name.lower(),
                        "query": "",
                        "aggregate": "count()",
                        "timeWindow": 3600,
                        "environment": self._resource("environment").name,
                        "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                    }
                ],
                "conditionGroup": {
                    "id": self._resource("detector_condition_group").id,
                    "organizationId": self.org.id,
                    "logicType": self._resource("detector_condition_group").logic_type,
                    "conditions": [
                        {
                            "type": Condition.GREATER,
                            "comparison": 100,
                            "conditionResult": DetectorPriorityLevel.HIGH,
                            "conditionGroupId": self._resource("detector_condition_group").id,
                        },
                        {
                            "type": Condition.LESS_OR_EQUAL,
                            "comparison": 100,
                            "conditionResult": DetectorPriorityLevel.OK,
                            "conditionGroupId": self._resource("detector_condition_group").id,
                        },
                    ],
                },
                "config": {
                    "thresholdPeriod": 1,
                    "detectionType": AlertRuleDetectionType.STATIC.value,
                },
                "workflowIds": [self._resource("workflow").id],
            },
            ("OrganizationMonitorIndexEndpoint", "POST"): {
                "project": self.project.slug,
                "name": "Permission Matrix Monitor",
                "type": "cron_job",
                "config": {"schedule_type": "crontab", "schedule": "@daily"},
            },
            ("NotificationActionsIndexEndpoint", "POST"): {
                "serviceType": "email",
                "triggerType": "audit-log",
                "targetType": "specific",
                "targetDisplay": "Permission matrix",
                "targetIdentifier": self.owner.email,
                "projects": [self.project.slug],
            },
            ("NotificationActionsDetailsEndpoint", "PUT"): {
                "serviceType": "email",
                "triggerType": "audit-log",
                "targetType": "specific",
                "targetDisplay": "Permission matrix",
                "targetIdentifier": self.owner.email,
            },
            ("OrganizationReleasesEndpoint", "POST"): {
                "version": f"matrix-release-{uuid4()}",
                "projects": [self.project.slug],
            },
            ("OrganizationReleaseDetailsEndpoint", "PUT"): {"ref": "permission-matrix-ref"},
            ("OrganizationReleaseFilesEndpoint", "POST"): {
                "name": "https://example.com/permission-matrix.js"
            },
            ("ReleaseDeploysEndpoint", "POST"): {"environment": "production"},
            ("OrganizationTeamsEndpoint", "POST"): {"name": "Permission Matrix Team"},
            ("OrganizationWorkflowIndexEndpoint", "POST"): {
                "name": "Permission Matrix Workflow",
                "enabled": True,
                "config": {},
                "triggers": {"logicType": "any", "conditions": []},
                "actionFilters": [],
            },
            ("OrganizationWorkflowIndexEndpoint", "PUT"): {"enabled": False},
            ("OrganizationWorkflowDetailsEndpoint", "PUT"): {
                "name": "Updated Permission Matrix Workflow",
                "enabled": True,
                "config": {},
                "triggers": {"logicType": "any", "conditions": []},
                "actionFilters": [],
            },
            ("ProjectDetailsEndpoint", "PUT"): {"name": self.project.name},
            ("ProjectEnvironmentDetailsEndpoint", "PUT"): {"name": "production-renamed"},
            ("ProjectEnvironmentsEndpoint", "PUT"): {
                "environmentNames": [self._resource("environment").name],
                "isHidden": True,
            },
            ("ProjectFilterDetailsEndpoint", "PUT"): {"active": True},
            ("ProjectKeyDetailsEndpoint", "PUT"): {"name": "Permission matrix key"},
            ("ProjectKeysEndpoint", "POST"): {"name": "Permission matrix key"},
            ("ProjectOwnershipEndpoint", "PUT"): {"raw": f"* {self.owner.email}"},
            ("ProjectPreprodSizeAnalysisSkipStatusCheckEndpoint", "POST"): {
                "sha": "a" * 40,
                "repository": "owner/not-integrated",
                "provider": "github",
            },
            ("ProjectPreprodSnapshotSkipStatusCheckEndpoint", "POST"): {
                "sha": "a" * 40,
                "repository": "owner/not-integrated",
                "provider": "github",
            },
            ("ProjectPreprodSnapshotEndpoint", "POST"): {
                "app_id": "com.example.permission-matrix",
                "images": {},
            },
            ("ProjectReplayDeletionJobsIndexEndpoint", "POST"): {
                "data": {
                    "rangeStart": (timezone.now() - timedelta(days=2)).isoformat(),
                    "rangeEnd": (timezone.now() - timedelta(days=1)).isoformat(),
                    "environments": ["production"],
                    "query": "",
                }
            },
            ("ProjectRepoEndpoint", "POST"): {"repositoryId": self._resource("repository").id},
            ("ProjectSymbolSourcesEndpoint", "POST"): {
                "name": "Permission matrix new source",
                "layout": {"type": "native"},
                "type": "http",
                "url": "https://new-symbols.example.com",
            },
            ("ProjectSymbolSourcesEndpoint", "PUT"): {
                **self._resource("symbol_source"),
                "name": "Updated permission matrix source",
            },
            ("TeamDetailsEndpoint", "PUT"): {"name": self.team.name},
            ("TeamProjectsEndpoint", "POST"): {"name": "Permission Matrix Team Project"},
        }
        return payloads.get(key, {})

    def _user_token(self, scopes: frozenset[str] | None = None) -> str:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = self.create_user_auth_token(
                user=self.owner,
                scope_list=sorted(settings.SENTRY_SCOPES if scopes is None else scopes),
            )
        return token.plaintext_token

    def _request(
        self,
        path: str,
        authentication: MatrixAuthentication,
        *,
        agent_bearer: str | None = None,
        user_token_scopes: frozenset[str] | None = None,
    ) -> Response:
        if authentication is MatrixAuthentication.SESSION:
            return self.client.get(path)

        client = APIClient()
        if authentication is MatrixAuthentication.USER_TOKEN:
            return client.get(
                path,
                HTTP_AUTHORIZATION=f"Bearer {self._user_token(user_token_scopes)}",
            )
        if authentication is MatrixAuthentication.VIEWER_CONTEXT:
            viewer_context = encode_viewer_context(
                ViewerContext(
                    user_id=self.owner.id,
                    organization_id=self.org.id,
                    project_id=self.project.id,
                    actor_type=ActorType.USER,
                ),
                key=SECRET,
            )
            return client.get(path, HTTP_X_VIEWER_CONTEXT=viewer_context)
        if authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
        }:
            assert agent_bearer is not None
            return client.get(path, HTTP_AUTHORIZATION=f"Bearer {agent_bearer}")
        raise AssertionError(f"unsupported authentication {authentication}")

    def _mutation_request(
        self,
        endpoint: PublicMutationEndpoint,
        path: str,
        payload: dict[str, Any],
        authentication: MatrixAuthentication,
        *,
        agent_bearer: str | None = None,
        user_token_scopes: frozenset[str] | None = None,
    ) -> Response:
        client = self.client if authentication is MatrixAuthentication.SESSION else APIClient()
        headers: dict[str, str] = {}
        if authentication is MatrixAuthentication.USER_TOKEN:
            headers["HTTP_AUTHORIZATION"] = f"Bearer {self._user_token(user_token_scopes)}"
        elif authentication is MatrixAuthentication.VIEWER_CONTEXT:
            headers["HTTP_X_VIEWER_CONTEXT"] = encode_viewer_context(
                ViewerContext(
                    user_id=self.owner.id,
                    organization_id=self.org.id,
                    project_id=self.project.id,
                    actor_type=ActorType.USER,
                ),
                key=SECRET,
            )
        elif authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
            MatrixAuthentication.APPROVED_AGENT_TOKEN,
        }:
            assert agent_bearer is not None
            headers["HTTP_AUTHORIZATION"] = f"Bearer {agent_bearer}"

        request_method = getattr(client, endpoint.method.lower())
        request_payload = payload
        request_format = "json"
        if endpoint.endpoint_name in {
            "OrganizationReleaseFilesEndpoint",
            "ProjectReleaseFilesEndpoint",
        }:
            request_payload = {
                **payload,
                "file": SimpleUploadedFile(
                    "permission-matrix.js",
                    b"function permissionMatrix() {}",
                    content_type="application/javascript",
                ),
            }
            request_format = "multipart"
        return request_method(
            path,
            data=request_payload,
            format=request_format,
            **headers,
        )

    def _rolled_back_mutation_request(
        self,
        endpoint: PublicMutationEndpoint,
        path: str,
        payload: dict[str, Any],
        authentication: MatrixAuthentication,
        *,
        user_token_scopes: frozenset[str] | None = None,
    ) -> Response:
        with assume_test_silo_mode(SiloMode.MONOLITH):
            savepoints = {
                database: transaction.savepoint(using=database) for database in settings.DATABASES
            }
        try:
            return self._mutation_request(
                endpoint,
                path,
                payload,
                authentication,
                user_token_scopes=user_token_scopes,
            )
        finally:
            with assume_test_silo_mode(SiloMode.MONOLITH):
                for database, savepoint in reversed(savepoints.items()):
                    transaction.savepoint_rollback(savepoint, using=database)
            # Model/option cache writes are not transactional. Remove the control
            # request's cached deletion/update so the replay observes the restored DB.
            cache.clear()

    def _assert_public_get_authentication(
        self,
        endpoint: PublicGetEndpoint,
        authentication: MatrixAuthentication,
    ) -> None:
        path = self._path(endpoint)
        # Control-silo endpoints must execute in their declared silo, but minting is a
        # cell operation. Mint before changing silo so this tests endpoint behavior rather
        # than the test router trying (and failing) to proxy token creation to a cell.
        agent_bearer = None
        agent_scopes = None
        if authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
        }:
            requested_scopes: frozenset[str] | None = (
                frozenset()
                if authentication is MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN
                else None
            )
            with self.feature(FLAG):
                agent_bearer = self._mint_agent_token(requested_scopes=requested_scopes)
            agent_scopes = frozenset(agent_token.decode_agent_token(agent_bearer)["scopes"])
        if endpoint.endpoint_name == "SeerModelsEndpoint":
            cache.set(SEER_MODELS_CACHE_KEY, {"models": ["matrix-model"]})
            self.addCleanup(cache.delete, SEER_MODELS_CACHE_KEY)
        if endpoint.endpoint_name == "GroupAutofixEndpoint":
            self.org.update_option("sentry:gen_ai_consent_v2024_11_14", True)

        silo_scope = (
            assume_test_silo_mode(endpoint.silo_mode)
            if endpoint.silo_mode is not None
            else nullcontext()
        )
        if endpoint.endpoint_name == "GroupAutofixEndpoint":
            downstream_scope: Any = patch(
                "sentry.seer.endpoints.group_ai_autofix.get_autofix_agent_state",
                return_value=None,
            )
        elif endpoint.endpoint_name in {
            "OrganizationProfilingChunksEndpoint",
            "OrganizationProfilingFlamegraphEndpoint",
        }:
            downstream_scope = patch(
                "sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service",
                return_value=HttpResponse(status=200),
            )
        elif endpoint.endpoint_name == "ProjectProfilingProfileEndpoint":
            downstream_scope = patch(
                "sentry.api.endpoints.project_profiling_profile.get_from_profiling_service",
                return_value=SimpleNamespace(
                    status=200,
                    data=b'{"metadata":{"version":""}}',
                    headers={},
                ),
            )
        else:
            downstream_scope = nullcontext()
        with silo_scope, downstream_scope, self.feature(self._feature_flags(endpoint)):
            baseline = self.client.get(path)
            authorization_oracle = baseline
            if authentication in {
                MatrixAuthentication.AGENT_TOKEN,
                MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
            }:
                assert agent_scopes is not None
                authorization_oracle = self._request(
                    path,
                    MatrixAuthentication.USER_TOKEN,
                    user_token_scopes=agent_scopes,
                )
            response = (
                baseline
                if authentication is MatrixAuthentication.SESSION
                else self._request(path, authentication, agent_bearer=agent_bearer)
            )

        assert baseline.status_code < 500, baseline.content
        expected_baseline_status = OUTER_BOUNDARY_GET_STATUSES.get(endpoint.endpoint_name, 200)
        assert baseline.status_code == expected_baseline_status, baseline.content

        # Successful representations can legitimately differ by credential (for
        # example, an ``access`` field must reflect narrower token scopes), and
        # time-series values can advance between requests. Endpoint-specific tests own
        # payload semantics; this matrix owns authentication and permission outcomes.
        responses_match = response.status_code == authorization_oracle.status_code and (
            authorization_oracle.status_code < 400
            or response.content == authorization_oracle.content
        )
        assert responses_match, (
            endpoint.path_template,
            authentication,
            authorization_oracle.content,
            response.content,
        )

    def _assert_public_mutation_authentication(
        self,
        endpoint: PublicMutationEndpoint,
        authentication: MatrixAuthentication,
    ) -> None:
        path = self._path(endpoint)
        payload = self._mutation_payload(endpoint)

        agent_bearer = None
        agent_scopes = None
        if authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
            MatrixAuthentication.APPROVED_AGENT_TOKEN,
        }:
            approved_scopes: frozenset[str] = frozenset()
            requested_scopes: frozenset[str] | None = None
            if authentication is MatrixAuthentication.APPROVED_AGENT_TOKEN:
                approved_scopes = frozenset(
                    endpoint.allowed_scopes
                    - agent_token.readonly_scopes()
                    - settings.SENTRY_TOKEN_ONLY_SCOPES
                )
                assert approved_scopes, endpoint
            elif authentication is MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN:
                requested_scopes = frozenset()
            with self.feature(FLAG):
                agent_bearer = self._mint_agent_token(
                    approved_scopes=approved_scopes,
                    requested_scopes=requested_scopes,
                )
            agent_scopes = frozenset(agent_token.decode_agent_token(agent_bearer)["scopes"])

        silo_scope = (
            assume_test_silo_mode(endpoint.silo_mode)
            if endpoint.silo_mode is not None
            else nullcontext()
        )
        downstream_scope: Any = (
            patch(
                "sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent",
                return_value=SimpleNamespace(seer_run_state_id=1, uuid=uuid4()),
            )
            if endpoint.endpoint_name == "GroupAutofixEndpoint"
            else nullcontext()
        )
        with silo_scope, downstream_scope, self.feature(self._feature_flags(endpoint)):
            # The session control proves the fixture can execute the operation. Roll it
            # back before replaying the same mutation with each matrix credential.
            baseline = self._rolled_back_mutation_request(
                endpoint,
                path,
                payload,
                MatrixAuthentication.SESSION,
            )

            authorization_oracle = baseline
            if authentication in {
                MatrixAuthentication.AGENT_TOKEN,
                MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
                MatrixAuthentication.APPROVED_AGENT_TOKEN,
            }:
                assert agent_scopes is not None
                authorization_oracle = self._rolled_back_mutation_request(
                    endpoint,
                    path,
                    payload,
                    MatrixAuthentication.USER_TOKEN,
                    user_token_scopes=agent_scopes,
                )

            response = (
                baseline
                if authentication is MatrixAuthentication.SESSION
                else self._mutation_request(
                    endpoint,
                    path,
                    payload,
                    authentication,
                    agent_bearer=agent_bearer,
                )
            )

        assert baseline.status_code < 500, baseline.content
        outer_status = OUTER_BOUNDARY_MUTATION_STATUSES.get(
            (endpoint.endpoint_name, endpoint.method)
        )
        if outer_status is None:
            assert baseline.status_code < 400, (
                endpoint.endpoint_name,
                endpoint.method,
                baseline.content,
            )
        else:
            assert baseline.status_code == outer_status, baseline.content

        responses_match = response.status_code == authorization_oracle.status_code and (
            authorization_oracle.status_code < 400
            or response.content == authorization_oracle.content
        )
        if authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
        }:
            assert agent_scopes is not None
            if not endpoint.allowed_scopes.intersection(agent_scopes):
                correctly_denied = response.status_code == 403 and response.get(
                    "WWW-Authenticate", ""
                ).startswith('Bearer error="insufficient_scope"')
                assert correctly_denied, response.content

        assert responses_match, (
            endpoint.path_template,
            endpoint.method,
            authentication,
            authorization_oracle.content,
            response.content,
        )


def _install_public_get_matrix_tests() -> None:
    """Generate real unittest methods because pytest cannot parametrize APITestCase."""

    for index, (endpoint, authentication) in enumerate(_matrix_cases()):

        def test_matrix_cell(
            self: AgentTokenPublicGetMatrixTest,
            endpoint: PublicGetEndpoint = endpoint,
            authentication: MatrixAuthentication = authentication,
        ) -> None:
            self._assert_public_get_authentication(endpoint, authentication)

        test_matrix_cell.__name__ = (
            f"test_public_get_{index:03d}_{endpoint.test_id}_{authentication.value}"
        )
        test_matrix_cell = getattr(pytest.mark, f"seer_matrix_{authentication.value}")(
            test_matrix_cell
        )
        if authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
        }:
            test_matrix_cell = pytest.mark.seer_matrix_minted_token(test_matrix_cell)
        setattr(AgentTokenPublicGetMatrixTest, test_matrix_cell.__name__, test_matrix_cell)


_install_public_get_matrix_tests()


def _install_public_mutation_matrix_tests() -> None:
    for index, (endpoint, authentication) in enumerate(_mutation_matrix_cases()):

        def test_matrix_cell(
            self: AgentTokenPublicGetMatrixTest,
            endpoint: PublicMutationEndpoint = endpoint,
            authentication: MatrixAuthentication = authentication,
        ) -> None:
            self._assert_public_mutation_authentication(endpoint, authentication)

        test_matrix_cell.__name__ = (
            f"test_public_mutation_{index:03d}_{endpoint.test_id}_{authentication.value}"
        )
        test_matrix_cell = getattr(pytest.mark, f"seer_matrix_{authentication.value}")(
            test_matrix_cell
        )
        if authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
            MatrixAuthentication.APPROVED_AGENT_TOKEN,
        }:
            test_matrix_cell = pytest.mark.seer_matrix_minted_token(test_matrix_cell)
        setattr(AgentTokenPublicGetMatrixTest, test_matrix_cell.__name__, test_matrix_cell)


_install_public_mutation_matrix_tests()
