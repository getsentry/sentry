from __future__ import annotations

import contextlib
from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import Any

import pytest
from django.contrib.sessions.backends.base import SessionBase
from django.test import RequestFactory, override_settings
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework.views import APIView

from sentry.api.authentication import AgentTokenAuthentication, UserAuthTokenAuthentication
from sentry.api.bases.organization import OrganizationPermission
from sentry.auth.access import Access
from sentry.models.organizationmember import OrganizationMember
from sentry.seer import agent_token
from sentry.seer.models.agent_write_grant import SeerAgentWriteGrant
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import drf_request_from_request
from sentry.users.models.user import User
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

    def _agent_request(
        self,
        user: User,
        scopes: Iterable[str],
        *,
        session_id: str = "sess-1",
        method: str = "PUT",
        ttl: timedelta | None = None,
        feature_enabled: bool = True,
    ) -> Request:
        token, _ = agent_token.encode_agent_token(
            user_id=user.id,
            organization_id=self.org.id,
            scopes=scopes,
            session_id=session_id,
            ttl=ttl if ttl is not None else agent_token.DEFAULT_TOKEN_TTL,
        )
        request = getattr(RequestFactory(), method.lower())("/api/0/organizations/")
        request.session = SessionBase()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        drf_request = drf_request_from_request(request)
        feature = self.feature(FLAG) if feature_enabled else contextlib.nullcontext()
        with feature:
            result = AgentTokenAuthentication().authenticate(drf_request)
        assert result is not None
        drf_request.user, drf_request.auth = result
        return drf_request

    def _grant(
        self,
        *,
        session_id: str = "s",
        scopes: Iterable[str] = ("org:write",),
        expires_at: datetime | None = None,
    ) -> SeerAgentWriteGrant:
        values: dict[str, Any] = {"scope_list": list(scopes)}
        if expires_at is not None:
            values["expires_at"] = expires_at
        return self.create_seer_agent_write_grant(
            organization=self.org,
            user=self.owner,
            session_id=session_id,
            **values,
        )

    def _has_object_perm(self, drf_request: Request) -> bool:
        return OrganizationPermission().has_object_permission(drf_request, APIView(), self.org)

    # ----- authentication -----

    def test_valid_token_authenticates_as_non_user_actor(self) -> None:
        # The agent is a non-user actor: the request user is anonymous and the credential
        # records the delegating user it acts on behalf of.
        request = self._agent_request(self.owner, ["org:read"], method="GET")
        assert request.user.is_anonymous
        assert request.auth is not None
        assert request.auth.kind == agent_token.AGENT_TOKEN_KIND
        assert request.auth.user_id == self.owner.id
        assert request.auth.get_scopes() == ["org:read"]

    def _auth(self, bearer: str, *, feature_enabled: bool = True) -> tuple[Any, Any] | None:
        request = RequestFactory().get("/api/0/organizations/")
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {bearer}"
        feature = self.feature(FLAG) if feature_enabled else contextlib.nullcontext()
        with feature:
            return AgentTokenAuthentication().authenticate(drf_request_from_request(request))

    def _typed_token(self, payload: dict[str, Any], *, key: str = SECRET) -> str:
        return jwt.encode(
            payload,
            key,
            headers={"typ": agent_token.AGENT_TOKEN_TYPE},
        )

    def test_minted_token_is_raw_typed_jwt(self) -> None:
        token, _ = agent_token.encode_agent_token(
            user_id=self.owner.id,
            organization_id=self.org.id,
            scopes=["org:read"],
            session_id="s1",
        )

        assert token.count(".") == 2
        assert jwt.peek_header(token)["typ"] == agent_token.AGENT_TOKEN_TYPE

    def test_non_agent_bearer_is_deferred(self) -> None:
        # An ordinary database-backed token stays with the existing authenticator.
        assert self._auth("sntryu_deadbeef") is None

    def test_raw_jwt_without_agent_type_is_deferred(self) -> None:
        token = jwt.encode(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": "1", "org": 1, "scopes": []},
            SECRET,
        )
        assert self._auth(token) is None

    def test_user_authenticator_defers_typed_agent_jwt(self) -> None:
        token, _ = agent_token.encode_agent_token(
            user_id=self.owner.id,
            organization_id=self.org.id,
            scopes=["org:read"],
            session_id="s1",
        )
        request = RequestFactory().get("/api/0/organizations/")
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"

        assert UserAuthTokenAuthentication().authenticate(drf_request_from_request(request)) is None

    def test_wrong_audience_is_rejected(self) -> None:
        token = self._typed_token({"aud": "something-else", "sub": "1", "org": 1, "scopes": []})
        with pytest.raises(AuthenticationFailed):
            self._auth(token)

    def test_forged_token_is_rejected(self) -> None:
        token = self._typed_token(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": "1", "org": 1, "scopes": []},
            key="wrong-secret",
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(token)

    @override_settings(SEER_API_SHARED_SECRET="")
    def test_empty_signing_secret_rejects_forged_token(self) -> None:
        token = self._typed_token(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": "1", "org": 1, "scopes": []},
            key="attacker-controlled-key",
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(token)

    def test_expired_token_is_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self._agent_request(self.owner, ["org:read"], ttl=timedelta(seconds=-1))

    def test_feature_off_rejects_already_issued_token(self) -> None:
        token, _ = agent_token.encode_agent_token(
            user_id=self.owner.id,
            organization_id=self.org.id,
            scopes=["org:read"],
            session_id="s1",
        )

        with pytest.raises(AuthenticationFailed):
            self._auth(token, feature_enabled=False)

    def test_signed_but_malformed_claims_are_rejected(self) -> None:
        # Right key and audience but broken claims -> clean auth failure, not a 500.
        null_sub = self._typed_token(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": None, "org": 1, "scopes": []},
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(null_sub)

        missing_org = self._typed_token(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": "1", "scopes": []}
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(missing_org)

        non_list_scopes = self._typed_token(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE, "sub": "1", "org": 1, "scopes": 5}
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(non_list_scopes)

        mapping_scopes = self._typed_token(
            {
                "aud": agent_token.AGENT_TOKEN_AUDIENCE,
                "sub": "1",
                "org": 1,
                "scopes": {"org:admin": False},
                "sid": "s1",
                "iat": 1,
                "exp": 2,
            }
        )
        with pytest.raises(AuthenticationFailed):
            self._auth(mapping_scopes)

    def test_missing_lifetime_or_session_claims_are_rejected(self) -> None:
        now = int(timezone.now().timestamp())
        base_claims = {
            "aud": agent_token.AGENT_TOKEN_AUDIENCE,
            "sub": "1",
            "org": 1,
            "scopes": ["org:read"],
            "sid": "s1",
            "iat": now,
            "exp": now + 300,
        }
        for missing in ("sid", "iat", "exp"):
            claims = {key: value for key, value in base_claims.items() if key != missing}
            with pytest.raises(AuthenticationFailed):
                self._auth(self._typed_token(claims))

    # ----- enforcement via the ordinary scope path -----
    # (Read-allowed and write-allowed happy paths are proven end-to-end over HTTP in
    # tests/sentry/seer/endpoints/test_organization_agent_token.py.)

    def test_token_cannot_exceed_member_role(self) -> None:
        # Token claims org:write, but a plain member's role does not grant it, so the
        # intersection in the access layer removes it -> denied at the object level.
        request = self._agent_request(self.member, ["org:read", "org:write"], method="PUT")
        assert self._has_object_perm(request) is False

    def _access_for(self, request: Request) -> Access:
        OrganizationPermission().has_object_permission(request, APIView(), self.org)
        return request.access

    def test_agent_access_mirrors_member_projects(self) -> None:
        # Access derives from the delegating member: a plain (non-global) member sees only
        # the projects on teams they belong to, never all org projects.
        self.org.flags.allow_joinleave = False
        self.org.save()
        team = self.create_team(organization=self.org)
        self.create_team_membership(user=self.member, team=team)
        member_project = self.create_project(organization=self.org, teams=[team])
        other_project = self.create_project(
            organization=self.org, teams=[self.create_team(organization=self.org)]
        )

        request = self._agent_request(self.member, ["org:read", "project:read"], method="GET")
        access = self._access_for(request)

        assert access.has_project_access(member_project)
        assert not access.has_project_access(other_project)

    def test_agent_denied_after_member_is_removed(self) -> None:
        # Ephemeral tokens re-derive authority from live membership on each request, so
        # removing the member denies a still-unexpired token mid-flight.
        request = self._agent_request(self.member, ["org:read"], method="GET")
        assert self._has_object_perm(request) is True

        OrganizationMember.objects.get(user_id=self.member.id, organization=self.org).delete()
        assert self._has_object_perm(request) is False

    def test_token_bound_to_minted_org_even_when_member_of_other(self) -> None:
        # The token is minted for self.org; the delegating user is also a member of another
        # org, but the token must never be honored there.
        other_org = self.create_organization()
        self.create_member(user=self.member, organization=other_org, role="owner")

        request = self._agent_request(self.member, ["org:read"], method="GET")
        assert (
            OrganizationPermission().has_object_permission(request, APIView(), other_org) is False
        )

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

    def test_reapproving_expired_grant_does_not_revive_old_scopes(self) -> None:
        grant = self._grant(
            session_id="expired",
            scopes=["org:admin"],
            expires_at=timezone.now() - timedelta(hours=1),
        )

        renewed = agent_token.create_write_grant(
            organization_id=self.org.id,
            user_id=self.owner.id,
            session_id="expired",
            scopes=["org:write"],
        )

        assert renewed.id == grant.id
        assert renewed.get_scopes() == ["org:write"]
