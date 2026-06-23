from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.sessions.backends.base import SessionBase
from django.test import RequestFactory, override_settings
from django.utils import timezone
from rest_framework.views import APIView

from sentry.api.authentication import ViewerContextAuthentication
from sentry.api.bases.organization import OrganizationPermission
from sentry.seer import agent_write_gate
from sentry.seer.agent_write_gate import AgentWritePermissionRequired
from sentry.seer.models.agent_write_grant import AgentWriteGrantStatus, SeerAgentWriteGrant
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import drf_request_from_request
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context

SECRET = "test-seer-api-shared-secret"
FLAG = "organizations:seer-agent-write-gate"


@override_settings(SEER_API_SHARED_SECRET=SECRET)
class AgentWriteGateTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.owner = self.create_user()
        self.create_member(user=self.owner, organization=self.org, role="owner")
        self.member = self.create_user()
        self.create_member(user=self.member, organization=self.org, role="member")

    def _agent_request(self, user, method="PUT", is_agent=True):
        context = encode_viewer_context(
            ViewerContext(user_id=user.id, actor_type=ActorType.USER), key=SECRET
        )
        request = getattr(RequestFactory(), method.lower())("/api/0/organizations/")
        request.session = SessionBase()
        request.META["HTTP_X_VIEWER_CONTEXT"] = context
        if is_agent:
            request.META["HTTP_X_IS_AGENT"] = "true"
        drf_request = drf_request_from_request(request)
        result = ViewerContextAuthentication().authenticate(drf_request)
        assert result is not None
        drf_request.user, drf_request.auth = result
        return drf_request

    def _has_object_perm(self, drf_request) -> bool:
        return OrganizationPermission().has_object_permission(drf_request, APIView(), self.org)

    # ----- functional -----

    def test_agent_read_is_allowed(self) -> None:
        request = self._agent_request(self.owner, method="GET")
        with self.feature(FLAG):
            assert self._has_object_perm(request) is True

    def test_agent_write_is_masked_and_challenged(self) -> None:
        request = self._agent_request(self.owner, method="PUT")
        with self.feature(FLAG):
            with pytest.raises(AgentWritePermissionRequired) as excinfo:
                self._has_object_perm(request)

        detail = excinfo.value.detail["detail"]
        assert detail["code"] == "agent-write-permission-required"
        extra = detail["extra"]
        assert "org:write" in extra["required_scopes"]
        assert extra["organization"] == self.org.slug
        assert extra["nonce"]
        assert extra["approval_endpoint"].endswith(f"/agent/approve/{extra['nonce']}/")

        grant = SeerAgentWriteGrant.objects.get(nonce=extra["nonce"])
        assert grant.status == AgentWriteGrantStatus.PENDING
        assert grant.organization_id == self.org.id
        assert grant.user_id == self.owner.id
        assert "org:write" in grant.get_scopes()

    def test_active_grant_unmasks_write(self) -> None:
        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            scope_list=["org:write"],
            status=AgentWriteGrantStatus.APPROVED,
            approved_at=timezone.now(),
        )
        request = self._agent_request(self.owner, method="PUT")
        with self.feature(FLAG):
            assert self._has_object_perm(request) is True

    def test_no_challenge_when_user_role_lacks_scope(self) -> None:
        # A plain member has no org:write, so the agent cannot be granted it:
        # ordinary denial, no challenge, no grant minted.
        request = self._agent_request(self.member, method="PUT")
        with self.feature(FLAG):
            assert self._has_object_perm(request) is False
        assert not SeerAgentWriteGrant.objects.filter(
            organization_id=self.org.id, user_id=self.member.id
        ).exists()

    def test_gate_disabled_is_no_op(self) -> None:
        # Flag off: the agent request behaves like a normal viewer-context request,
        # so the owner's write goes through and nothing is masked or challenged.
        request = self._agent_request(self.owner, method="PUT")
        assert self._has_object_perm(request) is True
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()

    def test_non_agent_request_unaffected(self) -> None:
        # Same viewer-context owner, but without the X-Is-Agent marker -> not gated.
        request = self._agent_request(self.owner, method="PUT", is_agent=False)
        with self.feature(FLAG):
            assert self._has_object_perm(request) is True
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()

    def test_expired_grant_does_not_unmask(self) -> None:
        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            scope_list=["org:write"],
            status=AgentWriteGrantStatus.APPROVED,
            approved_at=timezone.now() - timedelta(hours=10),
            expires_at=timezone.now() - timedelta(hours=1),
        )
        request = self._agent_request(self.owner, method="PUT")
        with self.feature(FLAG):
            with pytest.raises(AgentWritePermissionRequired):
                self._has_object_perm(request)

    # ----- unit -----

    def test_is_agent_request_requires_header_and_viewer_context(self) -> None:
        with_header = self._agent_request(self.owner, method="GET", is_agent=True)
        assert agent_write_gate.is_agent_request(with_header) is True

        no_header = self._agent_request(self.owner, method="GET", is_agent=False)
        assert agent_write_gate.is_agent_request(no_header) is False

    def test_masked_scopes_intersects_role(self) -> None:
        full = {"org:read", "org:write", "project:read"}
        masked = agent_write_gate.masked_scopes(full, self.org.id, self.owner.id)
        assert "org:write" not in masked
        assert "org:read" in masked
        assert "project:read" in masked

    def test_active_grant_scopes_excludes_pending_and_expired(self) -> None:
        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            scope_list=["org:write"],
            status=AgentWriteGrantStatus.PENDING,
        )
        assert agent_write_gate.active_grant_scopes(self.org.id, self.owner.id) == set()

        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            scope_list=["org:admin"],
            status=AgentWriteGrantStatus.APPROVED,
            approved_at=timezone.now(),
        )
        assert agent_write_gate.active_grant_scopes(self.org.id, self.owner.id) == {"org:admin"}

        # An approved-but-expired grant is excluded too.
        SeerAgentWriteGrant.objects.create(
            organization_id=self.org.id,
            user_id=self.owner.id,
            scope_list=["member:admin"],
            status=AgentWriteGrantStatus.APPROVED,
            approved_at=timezone.now() - timedelta(hours=5),
            expires_at=timezone.now() - timedelta(hours=1),
        )
        assert agent_write_gate.active_grant_scopes(self.org.id, self.owner.id) == {"org:admin"}
