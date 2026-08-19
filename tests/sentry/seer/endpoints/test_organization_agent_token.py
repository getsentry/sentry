from __future__ import annotations

from django.test import override_settings
from rest_framework.test import APIClient

from sentry.seer import agent_token
from sentry.seer.models.agent_write_grant import SeerAgentWriteGrant
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode

SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"
FLAG = "organizations:seer-agent-token-flow"


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

    def test_end_to_end_approved_write_succeeds(self) -> None:
        # The core happy path: browser approval persists the grant, reminting folds it into
        # the token, and the token passes a real organization write endpoint.
        self.login_as(self.owner)
        with self.feature(FLAG):
            approval = self.client.post(
                f"/api/0/organizations/{self.org.slug}/agent/approve/",
                data={"sessionId": "s1", "scopes": ["org:write"]},
                format="json",
            )
            assert approval.status_code == 200, approval.content
            token = self._mint(sessionId="s1").data["token"]
            write = self.client.put(
                f"/api/0/organizations/{self.org.slug}/",
                data={},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token}",
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
