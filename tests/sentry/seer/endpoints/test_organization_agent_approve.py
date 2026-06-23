from __future__ import annotations

from django.test import override_settings
from django.urls import reverse

from sentry.seer.models.agent_write_grant import AgentWriteGrantStatus, SeerAgentWriteGrant
from sentry.testutils.cases import APITestCase
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context

SECRET = "test-seer-api-shared-secret"


@override_settings(SEER_API_SHARED_SECRET=SECRET)
class OrganizationAgentApproveTest(APITestCase):
    endpoint = "sentry-api-0-organization-agent-approve"

    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.owner = self.create_user()
        self.create_member(user=self.owner, organization=self.org, role="owner")
        # A second owner in the same org — has every scope, but still must not be
        # able to act on someone else's grant.
        self.other = self.create_user()
        self.create_member(user=self.other, organization=self.org, role="owner")
        self.grant = self._pending_grant(self.owner)

    def _pending_grant(self, user, organization=None) -> SeerAgentWriteGrant:
        return SeerAgentWriteGrant.objects.create(
            organization_id=(organization or self.org).id,
            user_id=user.id,
            scope_list=["org:write"],
            status=AgentWriteGrantStatus.PENDING,
            operation="PUT /api/0/organizations/x/",
        )

    # ----- functional -----

    def test_owner_gets_details(self) -> None:
        self.login_as(self.owner)
        resp = self.get_success_response(self.org.slug, self.grant.nonce)
        assert resp.data["nonce"] == self.grant.nonce
        assert resp.data["status"] == AgentWriteGrantStatus.PENDING
        assert resp.data["requiredScopes"] == ["org:write"]

    def test_owner_approves(self) -> None:
        self.login_as(self.owner)
        resp = self.get_success_response(
            self.org.slug, self.grant.nonce, method="post", decision="approve"
        )
        assert resp.data["status"] == AgentWriteGrantStatus.APPROVED
        self.grant.refresh_from_db()
        assert self.grant.status == AgentWriteGrantStatus.APPROVED
        assert self.grant.approved_at is not None

    def test_owner_declines(self) -> None:
        self.login_as(self.owner)
        resp = self.get_success_response(
            self.org.slug, self.grant.nonce, method="post", decision="decline"
        )
        assert resp.data["status"] == AgentWriteGrantStatus.DECLINED
        self.grant.refresh_from_db()
        assert self.grant.status == AgentWriteGrantStatus.DECLINED

    def test_invalid_decision(self) -> None:
        self.login_as(self.owner)
        self.get_error_response(
            self.org.slug, self.grant.nonce, method="post", decision="bogus", status_code=400
        )

    # ----- IDOR / security -----

    def test_other_user_cannot_approve(self) -> None:
        # self.other is a full owner of the org, but the grant is not theirs.
        self.login_as(self.other)
        self.get_error_response(
            self.org.slug, self.grant.nonce, method="post", decision="approve", status_code=404
        )
        self.grant.refresh_from_db()
        assert self.grant.status == AgentWriteGrantStatus.PENDING

    def test_other_user_cannot_read_details(self) -> None:
        self.login_as(self.other)
        self.get_error_response(self.org.slug, self.grant.nonce, status_code=404)

    def test_cross_org_nonce_rejected(self) -> None:
        # Owner is a member of another org; using this org's nonce there must 404.
        other_org = self.create_organization(owner=self.owner)
        self.login_as(self.owner)
        self.get_error_response(other_org.slug, self.grant.nonce, status_code=404)
        self.grant.refresh_from_db()
        assert self.grant.status == AgentWriteGrantStatus.PENDING

    def test_approval_ignores_body_supplied_scopes(self) -> None:
        # Approval grants exactly the challenged scopes; extra scopes in the body
        # are ignored, so a user cannot escalate what the agent may do.
        self.login_as(self.owner)
        self.get_success_response(
            self.org.slug,
            self.grant.nonce,
            method="post",
            decision="approve",
            scopes=["org:admin", "member:admin"],
            scope_list=["org:admin"],
        )
        self.grant.refresh_from_db()
        assert self.grant.get_scopes() == ["org:write"]

    def test_agent_session_cannot_self_approve(self) -> None:
        # The agent carries the owner's viewer-context identity. Without the
        # first-party-session guard it could approve its own grant. It must be
        # blocked with 403, and the grant must stay pending.
        context = encode_viewer_context(
            ViewerContext(user_id=self.owner.id, actor_type=ActorType.USER), key=SECRET
        )
        url = reverse(self.endpoint, args=[self.org.slug, self.grant.nonce])
        resp = self.client.post(
            url,
            data={"decision": "approve"},
            HTTP_X_VIEWER_CONTEXT=context,
            HTTP_X_IS_AGENT="true",
        )
        assert resp.status_code == 403
        self.grant.refresh_from_db()
        assert self.grant.status == AgentWriteGrantStatus.PENDING
