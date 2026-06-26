from __future__ import annotations

from django.test import override_settings

from sentry.seer import agent_token
from sentry.seer.models.agent_write_grant import AgentWriteGrantStatus, SeerAgentWriteGrant
from sentry.testutils.cases import APITestCase
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context

SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"


@override_settings(SEER_API_SHARED_SECRET=SECRET)
class OrganizationAgentApproveTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)
        self.other = self.create_user()
        self.create_member(user=self.other, organization=self.org, role="owner")

    def _grant(self, user=None, organization=None, session_id="s1", scopes=("org:write",)):
        return SeerAgentWriteGrant.objects.create(
            organization_id=(organization or self.org).id,
            user_id=(user or self.owner).id,
            agent_session_id=session_id,
            scope_list=list(scopes),
            status=AgentWriteGrantStatus.PENDING,
        )

    def _url(self, nonce, organization=None):
        slug = (organization or self.org).slug
        return f"/api/0/organizations/{slug}/agent/approve/{nonce}/"

    # ----- happy path -----

    def test_get_returns_details_to_owner(self) -> None:
        grant = self._grant()
        self.login_as(self.owner)
        resp = self.client.get(self._url(grant.nonce))
        assert resp.status_code == 200
        assert resp.data["nonce"] == grant.nonce
        assert resp.data["requiredScopes"] == ["org:write"]

    def test_approve(self) -> None:
        grant = self._grant()
        self.login_as(self.owner)
        resp = self.client.post(self._url(grant.nonce), data={"decision": "approve"}, format="json")
        assert resp.status_code == 200
        grant.refresh_from_db()
        assert grant.status == AgentWriteGrantStatus.APPROVED
        assert grant.approved_at is not None

    def test_decline(self) -> None:
        grant = self._grant()
        self.login_as(self.owner)
        resp = self.client.post(self._url(grant.nonce), data={"decision": "decline"}, format="json")
        assert resp.status_code == 200
        grant.refresh_from_db()
        assert grant.status == AgentWriteGrantStatus.DECLINED

    def test_decline_then_approve_conflicts(self) -> None:
        grant = self._grant()
        self.login_as(self.owner)
        self.client.post(self._url(grant.nonce), data={"decision": "decline"}, format="json")
        resp = self.client.post(self._url(grant.nonce), data={"decision": "approve"}, format="json")
        assert resp.status_code == 409
        grant.refresh_from_db()
        assert grant.status == AgentWriteGrantStatus.DECLINED

    def test_invalid_decision(self) -> None:
        grant = self._grant()
        self.login_as(self.owner)
        resp = self.client.post(self._url(grant.nonce), data={"decision": "maybe"}, format="json")
        assert resp.status_code == 400

    # ----- IDOR -----

    def test_other_user_cannot_read(self) -> None:
        grant = self._grant(user=self.owner)
        self.login_as(self.other)
        assert self.client.get(self._url(grant.nonce)).status_code == 404

    def test_other_user_cannot_approve(self) -> None:
        grant = self._grant(user=self.owner)
        self.login_as(self.other)
        resp = self.client.post(self._url(grant.nonce), data={"decision": "approve"}, format="json")
        assert resp.status_code == 404
        grant.refresh_from_db()
        assert grant.status == AgentWriteGrantStatus.PENDING

    def test_cross_org_nonce_rejected(self) -> None:
        other_org = self.create_organization(owner=self.owner)
        grant = self._grant(user=self.owner, organization=self.org)
        self.login_as(self.owner)
        # Same nonce, but addressed under a different org -> not found.
        assert self.client.get(self._url(grant.nonce, organization=other_org)).status_code == 404

    def test_approval_cannot_escalate_scope(self) -> None:
        grant = self._grant(scopes=["org:write"])
        self.login_as(self.owner)
        resp = self.client.post(
            self._url(grant.nonce),
            data={"decision": "approve", "scopes": ["org:admin", "member:admin"]},
            format="json",
        )
        assert resp.status_code == 200
        grant.refresh_from_db()
        assert grant.get_scopes() == ["org:write"]

    # ----- self-approval is blocked -----

    def test_agent_token_cannot_self_approve(self) -> None:
        grant = self._grant()
        token, _ = agent_token.encode_agent_token(
            user_id=self.owner.id,
            organization_id=self.org.id,
            scopes=["org:read"],
            session_id="s1",
        )
        resp = self.client.post(
            self._url(grant.nonce),
            data={"decision": "approve"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert resp.status_code == 403
        grant.refresh_from_db()
        assert grant.status == AgentWriteGrantStatus.PENDING

    def test_viewer_context_cannot_self_approve(self) -> None:
        grant = self._grant()
        context = encode_viewer_context(
            ViewerContext(user_id=self.owner.id, actor_type=ActorType.USER), key=SECRET
        )
        resp = self.client.post(
            self._url(grant.nonce),
            data={"decision": "approve"},
            format="json",
            HTTP_X_VIEWER_CONTEXT=context,
        )
        assert resp.status_code == 403
        grant.refresh_from_db()
        assert grant.status == AgentWriteGrantStatus.PENDING
