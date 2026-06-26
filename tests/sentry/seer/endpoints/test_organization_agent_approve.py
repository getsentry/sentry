from __future__ import annotations

from datetime import timedelta

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
        self.other = self.create_user()
        self.create_member(user=self.other, organization=self.org, role="owner")

    def _challenge(
        self, *, user=None, organization=None, session_id="s1", scopes=("org:write",), ttl=None
    ):
        kwargs = {} if ttl is None else {"ttl": ttl}
        token, _ = agent_token.encode_challenge_token(
            user_id=(user or self.owner).id,
            organization_id=(organization or self.org).id,
            scopes=list(scopes),
            session_id=session_id,
            **kwargs,
        )
        return token

    def _url(self, organization=None):
        return f"/api/0/organizations/{(organization or self.org).slug}/agent/approve/"

    def _post(self, challenge, decision="approve", organization=None):
        return self.client.post(
            self._url(organization),
            data={"challenge": challenge, "decision": decision},
            format="json",
        )

    # ----- happy path -----

    def test_approve_creates_grant(self) -> None:
        self.login_as(self.owner)
        resp = self._post(self._challenge(scopes=["org:write"]))
        assert resp.status_code == 200, resp.content
        assert resp.data["status"] == "approved"
        grant = SeerAgentWriteGrant.objects.get(organization_id=self.org.id, user_id=self.owner.id)
        assert grant.get_scopes() == ["org:write"]
        assert grant.agent_session_id == "s1"

    def test_decline_persists_nothing(self) -> None:
        self.login_as(self.owner)
        resp = self._post(self._challenge(), decision="decline")
        assert resp.status_code == 200
        assert resp.data["status"] == "declined"
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()

    def test_invalid_decision(self) -> None:
        self.login_as(self.owner)
        assert self._post(self._challenge(), decision="maybe").status_code == 400

    def test_challenge_required(self) -> None:
        self.login_as(self.owner)
        resp = self.client.post(self._url(), data={"decision": "approve"}, format="json")
        assert resp.status_code == 400

    # ----- challenge validation -----

    def test_forged_challenge_rejected(self) -> None:
        import sentry.utils.jwt as jwt

        forged = jwt.encode(
            {
                "aud": agent_token.AGENT_APPROVAL_AUDIENCE,
                "sub": str(self.owner.id),
                "org": self.org.id,
                "scopes": ["org:admin"],
                "sid": "s1",
            },
            "wrong-secret",
        )
        self.login_as(self.owner)
        resp = self._post(forged)
        assert resp.status_code == 400
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()

    def test_expired_challenge_rejected(self) -> None:
        self.login_as(self.owner)
        resp = self._post(self._challenge(ttl=timedelta(seconds=-1)))
        assert resp.status_code == 400
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()

    # ----- identity / IDOR -----

    def test_other_user_cannot_approve_someone_elses_challenge(self) -> None:
        challenge = self._challenge(user=self.owner)
        self.login_as(self.other)
        resp = self._post(challenge)
        assert resp.status_code == 403
        assert not SeerAgentWriteGrant.objects.filter(user_id=self.owner.id).exists()

    def test_cross_org_challenge_rejected(self) -> None:
        other_org = self.create_organization(owner=self.owner)
        challenge = self._challenge(organization=self.org)  # issued for self.org
        self.login_as(self.owner)
        resp = self._post(challenge, organization=other_org)  # presented at other_org
        assert resp.status_code == 403
        assert not SeerAgentWriteGrant.objects.filter(user_id=self.owner.id).exists()

    def test_approval_grants_only_token_scopes(self) -> None:
        # Body cannot inject extra scopes; only the signed challenge's scopes are granted.
        self.login_as(self.owner)
        resp = self.client.post(
            self._url(),
            data={
                "challenge": self._challenge(scopes=["org:write"]),
                "decision": "approve",
                "scopes": ["org:admin", "member:admin"],
            },
            format="json",
        )
        assert resp.status_code == 200
        grant = SeerAgentWriteGrant.objects.get(organization_id=self.org.id)
        assert grant.get_scopes() == ["org:write"]

    # ----- self-approval is blocked -----

    def test_agent_token_cannot_self_approve(self) -> None:
        token, _ = agent_token.encode_agent_token(
            user_id=self.owner.id, organization_id=self.org.id, scopes=["org:read"], session_id="s1"
        )
        resp = self.client.post(
            self._url(),
            data={"challenge": self._challenge(), "decision": "approve"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert resp.status_code == 403
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()

    def test_viewer_context_cannot_self_approve(self) -> None:
        context = encode_viewer_context(
            ViewerContext(user_id=self.owner.id, actor_type=ActorType.USER), key=SECRET
        )
        resp = self.client.post(
            self._url(),
            data={"challenge": self._challenge(), "decision": "approve"},
            format="json",
            HTTP_X_VIEWER_CONTEXT=context,
        )
        assert resp.status_code == 403
        assert not SeerAgentWriteGrant.objects.filter(organization_id=self.org.id).exists()
