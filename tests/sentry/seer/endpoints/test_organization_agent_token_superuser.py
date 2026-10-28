from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from sentry.auth import access
from sentry.auth.superuser import SESSION_KEY, Superuser, get_superuser_access_expiry
from sentry.models.organizationmember import OrganizationMember
from sentry.organizations.services.organization import organization_service
from sentry.seer import agent_token
from sentry.seer.signed_seer_api import _resolve_viewer_context
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode
from sentry.viewer_context import (
    Actor,
    ActorType,
    SuperuserAccess,
    ViewerContext,
    encode_viewer_context,
    get_viewer_context,
    viewer_context_scope,
)

SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"
FLAG = "organizations:seer-agent-token-flow"


@override_settings(SEER_API_SHARED_SECRET=SECRET, SENTRY_SELF_HOSTED=False)
class SuperuserAgentTokenTest(APITestCase):
    endpoint = "sentry-api-0-organization-agent-token"

    def setUp(self) -> None:
        super().setUp()
        self.employee = self.create_user(is_superuser=True, is_staff=True)
        self.org = self.create_organization()
        self.path = f"/api/0/organizations/{self.org.slug}/"

    def _chat_authorization(self):
        self.login_as(self.employee, superuser=True)
        resolved_contexts: list[ViewerContext] = []
        with (
            self.feature([FLAG, "organizations:seer-explorer"]),
            patch(
                "sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None)
            ),
            patch("sentry.receivers.outbox.cell.make_agent_chat_request") as outbound,
        ):
            outbound.return_value.status = 200
            outbound.return_value.json.return_value = {"run_id": 123}

            def capture_context(*_args: Any, **kwargs: Any) -> Any:
                resolved = _resolve_viewer_context(kwargs["viewer_context"])
                assert resolved is not None
                resolved_contexts.append(resolved)
                return outbound.return_value

            outbound.side_effect = capture_context
            response = self.client.post(
                f"{self.path}seer/explorer-chat/", {"query": "List projects"}, format="json"
            )
        assert response.status_code == 200, response.content
        grant = resolved_contexts[0].actor.superuser
        assert grant is not None
        return grant

    def _mint(self, grant):
        viewer = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.USER, actor_id=self.employee.id, superuser=grant),
                organization_id=self.org.id,
            ),
            key=SECRET,
        )
        return APIClient().post(
            f"/api/0/organizations/{self.org.slug}/agent/token/",
            {"sessionId": "123"},
            format="json",
            HTTP_X_VIEWER_CONTEXT=viewer,
        )

    def _read(self, token, path=None):
        return APIClient().get(path or self.path, HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_chat_to_mint_to_read_without_membership(self):
        assert not OrganizationMember.objects.filter(
            organization=self.org, user_id=self.employee.id
        ).exists()
        grant = self._chat_authorization()
        project = self.create_project(organization=self.org)
        group = self.create_group(project=project)
        with self.feature(FLAG):
            minted = self._mint(grant)
            assert minted.status_code == 200, minted.content
            response = self._read(minted.data["token"])
            issue_response = self._read(minted.data["token"], f"/api/0/issues/{group.id}/")
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.org.id)
        assert issue_response.status_code == 200, issue_response.content
        assert issue_response.data["id"] == str(group.id)
        claims = agent_token.decode_agent_token(minted.data["token"])
        assert set(claims["scopes"]) <= agent_token.readonly_scopes()
        assert claims["superuser"] == {"expires_at": grant.expires_at}
        assert claims["exp"] <= grant.expires_at

    def test_identity_alone_does_not_delegate_superuser(self):
        self._chat_authorization()
        with self.feature(FLAG):
            assert self._mint(None).status_code == 403

    def test_nonmember_superuser_project_indexes_are_org_bound(self):
        assert not OrganizationMember.objects.filter(
            organization=self.org, user_id=self.employee.id
        ).exists()
        project = self.create_project(organization=self.org)
        other_org = self.create_organization()
        self.create_project(organization=other_org)
        grant = self._chat_authorization()
        with self.feature(FLAG):
            minted = self._mint(grant)
            assert minted.status_code == 200, minted.content
            global_response = self._read(minted.data["token"], "/api/0/projects/")
            org_response = self._read(minted.data["token"], f"{self.path}projects/")

        assert global_response.status_code == 200, global_response.content
        assert org_response.status_code == 200, org_response.content
        assert {int(item["id"]) for item in global_response.data} == {project.id}
        assert {int(item["id"]) for item in org_response.data} == {project.id}

    def test_elevated_browser_can_also_mint_a_usable_token(self):
        self.login_as(self.employee, superuser=True)
        with self.feature(FLAG):
            minted = self.client.post(
                f"{self.path}agent/token/", {"sessionId": "123"}, format="json"
            )
            assert minted.status_code == 200, minted.content
            assert self._read(minted.data["token"]).status_code == 200

    def test_elevated_member_keeps_approved_agent_writes(self):
        self.create_member(user=self.employee, organization=self.org, role="owner")
        self.create_seer_agent_write_grant(
            organization=self.org, user=self.employee, session_id="123", scope_list=["org:write"]
        )
        self.login_as(self.employee, superuser=True)
        with self.feature(FLAG):
            minted = self.client.post(
                f"{self.path}agent/token/", {"sessionId": "123"}, format="json"
            )
            assert minted.status_code == 200, minted.content
            claims = agent_token.decode_agent_token(minted.data["token"])
            assert "superuser" not in claims
            assert "org:write" in claims["scopes"]
            client = APIClient()
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {minted.data['token']}")
            assert client.put(self.path, {}, format="json").status_code == 200

    def test_invalid_expiry_cannot_mint(self):
        self._chat_authorization()
        with self.feature(FLAG):
            assert self._mint(SuperuserAccess(expires_at=True)).status_code == 401

    def test_expired_elevation_cannot_mint_or_be_used(self):
        grant = self._chat_authorization()
        with self.feature(FLAG):
            minted = self._mint(grant)
            assert minted.status_code == 200, minted.content
            with freeze_time(timezone.now() + timedelta(minutes=6)):
                assert self._mint(grant).status_code == 401
                assert self._read(minted.data["token"]).status_code == 401

    def test_current_user_privilege_is_rechecked_without_cache_clear(self):
        self._assert_revoked({"is_superuser": False})

    def test_inactive_user_cannot_use_elevation(self):
        self._assert_revoked({"is_active": False})

    def test_suspended_user_cannot_use_elevation(self):
        self._assert_revoked({"is_suspended": True})

    def _assert_revoked(self, changes):
        grant = self._chat_authorization()
        with self.feature(FLAG):
            minted = self._mint(grant)
            assert minted.status_code == 200, minted.content
            with assume_test_silo_mode(SiloMode.CONTROL):
                self.employee.update(**changes)
            assert self._mint(grant).status_code == 403
            assert self._read(minted.data["token"]).status_code == 401

    def test_delegated_token_cannot_write_remint_or_cross_org(self):
        self._assert_read_only_delegated_token()

    def test_writable_browser_cannot_delegate_agent_writes(self):
        self.add_user_permission(self.employee, "superuser.write")
        with self.options({"superuser.read-write.ga-rollout": True}):
            self._assert_read_only_delegated_token()

    def _assert_read_only_delegated_token(self):
        grant = self._chat_authorization()
        other_org = self.create_organization()
        self.create_seer_agent_write_grant(
            organization=self.org, user=self.employee, session_id="123", scope_list=["org:write"]
        )
        with self.feature(FLAG):
            minted = self._mint(grant)
            assert minted.status_code == 200, minted.content
            assert set(minted.data["scopes"]) <= agent_token.readonly_scopes()
            client = APIClient()
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {minted.data['token']}")
            assert client.put(self.path, {}, format="json").status_code == 403
            assert (
                client.post(
                    f"{self.path}agent/token/", {"sessionId": "123"}, format="json"
                ).status_code
                == 403
            )
            assert client.get(f"/api/0/organizations/{other_org.slug}/").status_code == 403

    def test_customer_policy_is_rechecked(self):
        grant = self._chat_authorization()
        with self.feature(FLAG):
            minted = self._mint(grant)
            assert minted.status_code == 200, minted.content
            with patch("sentry.auth.superuser.should_allow_superuser_access", return_value=False):
                assert self._mint(grant).status_code == 401
                assert self._read(minted.data["token"]).status_code == 401

    @override_settings(VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True)
    def test_delegation_requires_existing_org_approval(self):
        with self.settings(VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=False):
            self.login_as(self.employee, superuser=True)
        request = self.make_request(user=self.employee)
        request.auth = None
        request.session = self.client.session
        request.COOKIES = {name: value.value for name, value in self.client.cookies.items()}
        request.superuser = Superuser(request)
        org_context = organization_service.get_organization_by_id(
            id=self.org.id, user_id=self.employee.id
        )
        assert org_context is not None
        with self.feature(FLAG):
            with viewer_context_scope(
                ViewerContext(actor=Actor(type=ActorType.USER, actor_id=self.employee.id))
            ):
                access.from_request_org_and_scopes(
                    request=request, rpc_user_org_context=org_context
                )
                viewer = get_viewer_context()
                assert viewer is not None
                assert viewer.actor.superuser is None

                request.superuser.authorize_org(
                    self.org.slug, "for_unit_test", "Testing delegated access"
                )
                access.from_request_org_and_scopes(
                    request=request, rpc_user_org_context=org_context
                )
                viewer = get_viewer_context()
                assert viewer is not None
                grant = viewer.actor.superuser
            assert grant is not None
            assert self._mint(grant).status_code == 200

    def test_delegation_does_not_renew_idle_expiry(self):
        self.login_as(self.employee, superuser=True)
        request = self.make_request(user=self.employee)
        request.auth = None
        request.session = self.client.session
        request.COOKIES = {name: value.value for name, value in self.client.cookies.items()}
        request.superuser = Superuser(request)
        idle_expiry = timezone.now() + timedelta(seconds=30)
        request.session[SESSION_KEY]["idl"] = str(idle_expiry.timestamp())
        with self.feature(FLAG):
            expiry = get_superuser_access_expiry(request.superuser, self.org.id)
            assert expiry is not None
            grant = SuperuserAccess(expires_at=expiry)
            minted = self._mint(grant)
            assert minted.status_code == 200, minted.content
            claims = agent_token.decode_agent_token(minted.data["token"])
            assert claims["exp"] <= int(idle_expiry.timestamp())
            with freeze_time(idle_expiry + timedelta(seconds=1)):
                assert self._mint(grant).status_code == 401
                assert self._read(minted.data["token"]).status_code == 401
