from __future__ import annotations

from django.test import override_settings

from sentry.seer import agent_token
from sentry.seer.models.agent_write_grant import SeerAgentWriteGrant
from sentry.testutils.cases import APITestCase
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context

SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"


@override_settings(SEER_API_SHARED_SECRET=SECRET)
class OrganizationAgentApproveTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)
        self.member = self.create_user()
        self.create_member(user=self.member, organization=self.org, role="member")

    def _url(self, organization=None):
        return f"/api/0/organizations/{(organization or self.org).slug}/agent/approve/"

    def _post(self, *, scopes, session_id="s1", feature_enabled=True, **kwargs):
        if feature_enabled:
            with self.feature(agent_token.FEATURE_FLAG):
                return self.client.post(
                    self._url(),
                    data={"sessionId": session_id, "scopes": list(scopes)},
                    format="json",
                    **kwargs,
                )
        return self.client.post(
            self._url(),
            data={"sessionId": session_id, "scopes": list(scopes)},
            format="json",
            **kwargs,
        )

    # ----- happy path -----

    def test_feature_off_is_not_found(self) -> None:
        self.login_as(self.owner)
        resp = self._post(scopes=["org:write"], feature_enabled=False)
        assert resp.status_code == 404
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()

    def test_approve_creates_grant(self) -> None:
        self.login_as(self.owner)
        resp = self._post(scopes=["org:write"])
        assert resp.status_code == 200, resp.content
        assert resp.data["status"] == "approved"
        grant = SeerAgentWriteGrant.objects.get(organization_id=self.org.id, user_id=self.owner.id)
        assert grant.get_scopes() == ["org:write"]
        assert grant.agent_session_id == "s1"

    def test_reapproving_refreshes_not_duplicates(self) -> None:
        self.login_as(self.owner)
        assert self._post(scopes=["org:write"]).status_code == 200
        assert self._post(scopes=["org:write"]).status_code == 200
        assert (
            SeerAgentWriteGrant.objects.filter(
                organization_id=self.org.id, user_id=self.owner.id
            ).count()
            == 1
        )

    def test_approving_more_scopes_merges_into_one_row(self) -> None:
        self.login_as(self.owner)
        assert self._post(scopes=["org:write"]).status_code == 200
        assert self._post(scopes=["org:admin"]).status_code == 200
        grants = SeerAgentWriteGrant.objects.filter(
            organization_id=self.org.id, user_id=self.owner.id, agent_session_id="s1"
        )
        assert grants.count() == 1
        assert grants.get().get_scopes() == ["org:admin", "org:write"]

    def test_session_id_too_long_rejected(self) -> None:
        self.login_as(self.owner)
        resp = self._post(scopes=["org:write"], session_id="x" * 129)
        assert resp.status_code == 400
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()

    # ----- validation -----

    def test_session_id_required(self) -> None:
        self.login_as(self.owner)
        with self.feature(agent_token.FEATURE_FLAG):
            resp = self.client.post(self._url(), data={"scopes": ["org:write"]}, format="json")
        assert resp.status_code == 400

    def test_non_object_body_rejected(self) -> None:
        self.login_as(self.owner)
        with self.feature(agent_token.FEATURE_FLAG):
            response = self.client.post(self._url(), data=["not", "an", "object"], format="json")
        assert response.status_code == 400
        assert response.data == {"detail": "Request body must be an object."}

    def test_scopes_must_be_a_list(self) -> None:
        self.login_as(self.owner)
        with self.feature(agent_token.FEATURE_FLAG):
            resp = self.client.post(
                self._url(), data={"sessionId": "s1", "scopes": "org:write"}, format="json"
            )
        assert resp.status_code == 400

    # ----- escalation cap -----

    def test_scopes_capped_at_approver_access(self) -> None:
        # A plain member lacks org:write, so it is not grantable even when requested.
        self.login_as(self.member)
        resp = self._post(scopes=["org:write"])
        assert resp.status_code == 400
        assert not SeerAgentWriteGrant.objects.filter(user_id=self.member.id).exists()

    def test_only_held_scopes_are_granted(self) -> None:
        # Member holds org:read but not org:write; only the held scope persists.
        self.login_as(self.member)
        resp = self._post(scopes=["org:read", "org:write"])
        assert resp.status_code == 200
        grant = SeerAgentWriteGrant.objects.get(user_id=self.member.id)
        assert grant.get_scopes() == ["org:read"]

    # ----- self-approval is blocked -----

    def test_agent_token_cannot_self_approve(self) -> None:
        token, _ = agent_token.encode_agent_token(
            user_id=self.owner.id, organization_id=self.org.id, scopes=["org:read"], session_id="s1"
        )
        resp = self._post(scopes=["org:write"], HTTP_AUTHORIZATION=f"Bearer {token}")
        assert resp.status_code == 403
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()

    def test_viewer_context_cannot_self_approve(self) -> None:
        context = encode_viewer_context(
            ViewerContext(user_id=self.owner.id, actor_type=ActorType.USER), key=SECRET
        )
        resp = self._post(scopes=["org:write"], HTTP_X_VIEWER_CONTEXT=context)
        assert resp.status_code == 403
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()
