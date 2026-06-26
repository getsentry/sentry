from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.sessions.backends.base import SessionBase
from django.test import RequestFactory, override_settings
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.views import APIView

from sentry.api.authentication import AgentTokenAuthentication
from sentry.api.bases.organization import OrganizationPermission
from sentry.seer import agent_token
from sentry.seer.agent_token import AgentWritePermissionRequired
from sentry.seer.models.agent_write_grant import AgentWriteGrantStatus, SeerAgentWriteGrant
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import drf_request_from_request
from sentry.utils import jwt

SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"
FLAG = "organizations:seer-agent-token-flow"


@override_settings(SEER_API_SHARED_SECRET=SECRET)
class AgentTokenAuthAndGateTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.owner = self.create_user()
        self.create_member(user=self.owner, organization=self.org, role="owner")
        self.member = self.create_user()
        self.create_member(user=self.member, organization=self.org, role="member")

    def _agent_request(self, user, scopes, *, session_id="sess-1", method="PUT", ttl=None):
        kwargs = {} if ttl is None else {"ttl": ttl}
        token, _ = agent_token.encode_agent_token(
            user_id=user.id,
            organization_id=self.org.id,
            scopes=scopes,
            session_id=session_id,
            **kwargs,
        )
        request = getattr(RequestFactory(), method.lower())("/")
        request.session = SessionBase()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        drf_request = drf_request_from_request(request)
        result = AgentTokenAuthentication().authenticate(drf_request)
        assert result is not None
        drf_request.user, drf_request.auth = result
        return drf_request

    def _has_permission(self, drf_request) -> bool:
        return OrganizationPermission().has_permission(drf_request, APIView())

    def _has_object_perm(self, drf_request) -> bool:
        return OrganizationPermission().has_object_permission(drf_request, APIView(), self.org)

    # ----- authentication -----

    def test_valid_token_authenticates_as_user_with_token_scopes(self) -> None:
        request = self._agent_request(self.owner, ["org:read"], method="GET")
        assert request.user.id == self.owner.id
        assert request.auth is not None
        assert request.auth.get_scopes() == ["org:read"]
        # The challenge step recognizes this as an agent request.
        assert agent_token.get_agent_claims(request) is not None

    def test_non_agent_bearer_is_deferred(self) -> None:
        # An opaque (non-JWT) bearer is not ours: we defer so the normal token auth runs.
        request = RequestFactory().get("/")
        request.META["HTTP_AUTHORIZATION"] = "Bearer sntrya_deadbeef"
        assert AgentTokenAuthentication().authenticate(drf_request_from_request(request)) is None

    def test_wrong_audience_is_deferred(self) -> None:
        # A signed JWT for a different audience is not an agent token; defer, don't reject.
        token = jwt.encode({"aud": "something-else", "sub": "1", "org": 1, "scopes": []}, SECRET)
        request = RequestFactory().get("/")
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        assert AgentTokenAuthentication().authenticate(drf_request_from_request(request)) is None

    def test_forged_token_is_rejected(self) -> None:
        # Right audience, wrong signature -> it claims to be an agent token but is forged.
        token = jwt.encode(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": "1", "org": 1, "scopes": []},
            "wrong-secret",
        )
        request = RequestFactory().get("/")
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        with pytest.raises(AuthenticationFailed):
            AgentTokenAuthentication().authenticate(drf_request_from_request(request))

    def test_expired_token_is_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self._agent_request(self.owner, ["org:read"], ttl=timedelta(seconds=-1))

    # ----- enforcement via the ordinary scope path -----
    # (Read-allowed and write-allowed happy paths are proven end-to-end over HTTP in
    # tests/sentry/seer/endpoints/test_organization_agent_token.py.)

    def test_token_cannot_exceed_member_role(self) -> None:
        # Token claims org:write, but a plain member's role does not grant it, so the
        # intersection in the access layer removes it -> denied at the object level.
        request = self._agent_request(self.member, ["org:read", "org:write"], method="PUT")
        assert self._has_object_perm(request) is False

    # ----- challenge -----

    def test_readonly_token_write_is_challenged(self) -> None:
        request = self._agent_request(self.owner, ["org:read"], method="PUT", session_id="abc")
        with pytest.raises(AgentWritePermissionRequired) as excinfo:
            self._has_permission(request)

        detail = excinfo.value.detail["detail"]
        assert detail["code"] == "agent-write-permission-required"
        extra = detail["extra"]
        assert "org:write" in extra["required_scopes"]
        assert extra["organization"] == self.org.slug
        assert extra["approval_endpoint"].endswith(f"/agent/approve/{extra['nonce']}/")

        grant = SeerAgentWriteGrant.objects.get(nonce=extra["nonce"])
        assert grant.status == AgentWriteGrantStatus.PENDING
        assert grant.user_id == self.owner.id
        assert grant.agent_session_id == "abc"
        assert "org:write" in grant.get_scopes()

    def test_no_challenge_when_role_lacks_scope(self) -> None:
        # A plain member has no org:write to grant, so an ordinary denial follows.
        request = self._agent_request(self.member, ["org:read"], method="PUT")
        assert self._has_permission(request) is False
        assert not SeerAgentWriteGrant.objects.filter(user_id=self.member.id).exists()

    # ----- scope computation (de-escalation rule) -----

    def test_compute_scopes_defaults_to_readonly(self) -> None:
        scopes = agent_token.compute_token_scopes(
            caller_scopes={"org:read", "org:write", "project:read"},
            organization_id=self.org.id,
            user_id=self.owner.id,
            session_id="s",
        )
        assert "org:write" not in scopes
        assert "org:read" in scopes
        assert "project:read" in scopes

    def test_compute_scopes_includes_active_grant(self) -> None:
        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            agent_session_id="s",
            scope_list=["org:write"],
            status=AgentWriteGrantStatus.APPROVED,
            approved_at=timezone.now(),
        )
        scopes = agent_token.compute_token_scopes(
            caller_scopes={"org:read", "org:write"},
            organization_id=self.org.id,
            user_id=self.owner.id,
            session_id="s",
        )
        assert "org:write" in scopes

    def test_compute_scopes_never_exceeds_caller(self) -> None:
        # An approved grant for a scope the caller does not currently hold is dropped.
        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            agent_session_id="s",
            scope_list=["org:write"],
            status=AgentWriteGrantStatus.APPROVED,
            approved_at=timezone.now(),
        )
        scopes = agent_token.compute_token_scopes(
            caller_scopes={"org:read"},  # caller lacks org:write right now
            organization_id=self.org.id,
            user_id=self.owner.id,
            session_id="s",
        )
        assert "org:write" not in scopes

    def test_requested_scopes_can_only_narrow(self) -> None:
        scopes = agent_token.compute_token_scopes(
            caller_scopes={"org:read", "project:read"},
            organization_id=self.org.id,
            user_id=self.owner.id,
            session_id="s",
            requested_scopes=["org:read"],
        )
        assert scopes == ["org:read"]

    def test_active_grant_scopes_excludes_pending_expired_and_other_session(self) -> None:
        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            agent_session_id="s",
            scope_list=["org:write"],
            status=AgentWriteGrantStatus.PENDING,
        )
        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            agent_session_id="other",
            scope_list=["member:admin"],
            status=AgentWriteGrantStatus.APPROVED,
            approved_at=timezone.now(),
        )
        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            agent_session_id="s",
            scope_list=["org:admin"],
            status=AgentWriteGrantStatus.APPROVED,
            approved_at=timezone.now() - timedelta(hours=5),
            expires_at=timezone.now() - timedelta(hours=1),
        )
        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            agent_session_id="s",
            scope_list=["org:write"],
            status=AgentWriteGrantStatus.APPROVED,
            approved_at=timezone.now(),
        )
        assert agent_token.active_grant_scopes(self.org.id, self.owner.id, "s") == {"org:write"}
