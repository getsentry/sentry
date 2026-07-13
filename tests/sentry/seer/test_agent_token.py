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
from sentry.seer.models.agent_write_grant import SeerAgentWriteGrant
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import drf_request_from_request
from sentry.types.token import SENTRY_AGENT_TOKEN_PREFIX
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
        request = getattr(RequestFactory(), method.lower())("/api/0/organizations/")
        request.session = SessionBase()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        drf_request = drf_request_from_request(request)
        result = AgentTokenAuthentication().authenticate(drf_request)
        assert result is not None
        drf_request.user, drf_request.auth = result
        return drf_request

    def _grant(self, *, session_id="s", scopes=("org:write",), expires_at=None):
        return SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            agent_session_id=session_id,
            scope_list=list(scopes),
            **({"expires_at": expires_at} if expires_at else {}),
        )

    def _has_object_perm(self, drf_request) -> bool:
        return OrganizationPermission().has_object_permission(drf_request, APIView(), self.org)

    # ----- authentication -----

    def test_valid_token_authenticates_as_user_with_token_scopes(self) -> None:
        request = self._agent_request(self.owner, ["org:read"], method="GET")
        assert request.user.id == self.owner.id
        assert request.auth is not None
        assert request.auth.get_scopes() == ["org:read"]
        assert agent_token.get_agent_claims(request) is not None

    def _auth(self, bearer: str):
        request = RequestFactory().get("/api/0/organizations/")
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {bearer}"
        return AgentTokenAuthentication().authenticate(drf_request_from_request(request))

    def test_non_agent_bearer_is_deferred(self) -> None:
        # No agent prefix -> accepts_auth is False -> defer to the rest of the chain.
        assert self._auth("sntryu_deadbeef") is None

    def test_wrong_audience_is_rejected(self) -> None:
        # Prefixed (so we claim it), but the signed audience is wrong -> hard reject.
        token = SENTRY_AGENT_TOKEN_PREFIX + jwt.encode(
            {"aud": "something-else", "sub": "1", "org": 1, "scopes": []}, SECRET
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(token)

    def test_forged_token_is_rejected(self) -> None:
        # Prefixed, right audience, wrong signing key -> hard reject.
        token = SENTRY_AGENT_TOKEN_PREFIX + jwt.encode(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": "1", "org": 1, "scopes": []},
            "wrong-secret",
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(token)

    def test_expired_token_is_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self._agent_request(self.owner, ["org:read"], ttl=timedelta(seconds=-1))

    def test_signed_but_malformed_claims_are_rejected(self) -> None:
        # Right key and audience but broken claims -> clean auth failure, not a 500.
        null_sub = SENTRY_AGENT_TOKEN_PREFIX + jwt.encode(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": None, "org": 1, "scopes": []},
            SECRET,
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(null_sub)

        missing_org = SENTRY_AGENT_TOKEN_PREFIX + jwt.encode(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": "1", "scopes": []}, SECRET
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(missing_org)

        non_list_scopes = SENTRY_AGENT_TOKEN_PREFIX + jwt.encode(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": "1", "org": 1, "scopes": 5}, SECRET
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(non_list_scopes)

    # ----- enforcement via the ordinary scope path -----
    # (Read-allowed and write-allowed happy paths are proven end-to-end over HTTP in
    # tests/sentry/seer/endpoints/test_organization_agent_token.py.)

    def test_token_cannot_exceed_member_role(self) -> None:
        # Token claims org:write, but a plain member's role does not grant it, so the
        # intersection in the access layer removes it -> denied at the object level.
        request = self._agent_request(self.member, ["org:read", "org:write"], method="PUT")
        assert self._has_object_perm(request) is False

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
        self._grant(session_id="s", scopes=["org:write"])
        scopes = agent_token.compute_token_scopes(
            caller_scopes={"org:read", "org:write"},
            organization_id=self.org.id,
            user_id=self.owner.id,
            session_id="s",
        )
        assert "org:write" in scopes

    def test_compute_scopes_never_exceeds_caller(self) -> None:
        # A grant for a scope the caller does not currently hold is dropped.
        self._grant(session_id="s", scopes=["org:write"])
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

    def test_active_grant_scopes_excludes_expired_and_other_session(self) -> None:
        # One row per session, so expiry is tested with its own session: the queried
        # session returns only its active scope, never the other session's or the expired one's.
        self._grant(session_id="active", scopes=["org:write"])
        self._grant(session_id="other", scopes=["member:admin"])
        self._grant(
            session_id="expired",
            scopes=["org:admin"],
            expires_at=timezone.now() - timedelta(hours=1),
        )
        assert agent_token.active_grant_scopes(self.org.id, self.owner.id, "active") == {
            "org:write"
        }
        assert agent_token.active_grant_scopes(self.org.id, self.owner.id, "expired") == set()
