from typing import Any

from django.test import override_settings
from django.urls import reverse

from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    decode_viewer_context,
    encode_viewer_context,
)

FEATURE_FLAG = "organizations:service-accounts"
SECRET = "service-accounts-test-viewer-context-secret"


class OrganizationServiceAccountIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-service-accounts"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_flag_off_returns_404(self) -> None:
        self.get_error_response(self.organization.slug, status_code=404)

    def test_list(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug)

        assert response.data == [
            {
                "id": "1",
                "name": "seer-autofix",
                "scopes": ["event:read", "org:read", "project:read"],
                "isActive": True,
                "dateCreated": "2026-10-14T00:00:00Z",
            }
        ]

    def test_member_can_list(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        with self.feature(FEATURE_FLAG):
            self.get_success_response(self.organization.slug)

    def test_create(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["project:read", "event:read"],
                status_code=201,
            )

        assert response.data["name"] == "nightly-triage"
        assert response.data["scopes"] == ["event:read", "project:read"]
        assert response.data["isActive"] is True

    def test_create_requires_org_admin(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                status_code=403,
            )

    def test_create_rejects_unknown_scope(self) -> None:
        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:everything"],
                status_code=400,
            )

    def test_create_rejects_scopes_caller_lacks(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = self.create_user_auth_token(user=self.user, scope_list=["org:admin"])
        url = reverse(self.endpoint, args=[self.organization.slug])

        with self.feature(FEATURE_FLAG):
            response = self.client.post(
                url,
                data={"name": "nightly-triage", "scopes": ["event:read"]},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
            )

        assert response.status_code == 400
        assert "event:read" in str(response.data["detail"])


class OrganizationServiceAccountDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-service-account-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_flag_off_returns_404(self) -> None:
        self.get_error_response(self.organization.slug, "7", status_code=404)

    def test_get(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug, "7")

        assert response.data["id"] == "7"

    def test_update(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                "7",
                method="put",
                name="renamed",
                isActive=False,
            )

        assert response.data["id"] == "7"
        assert response.data["name"] == "renamed"
        assert response.data["isActive"] is False

    def test_delete(self) -> None:
        with self.feature(FEATURE_FLAG):
            self.get_success_response(self.organization.slug, "7", method="delete", status_code=204)


@override_settings(SEER_API_SHARED_SECRET=SECRET)
class OrganizationServiceAccountViewerContextTest(APITestCase):
    endpoint = "sentry-api-0-organization-service-account-viewer-context"

    def _post(self, viewer_context: ViewerContext) -> Any:
        url = reverse(self.endpoint, args=[self.organization.slug, "7"])
        with self.feature(FEATURE_FLAG):
            return self.client.post(
                url, HTTP_X_VIEWER_CONTEXT=encode_viewer_context(viewer_context)
            )

    def test_returns_org_viewer_context(self) -> None:
        response = self._post(
            ViewerContext(organization_id=self.organization.id, actor_type=ActorType.SYSTEM)
        )

        assert response.status_code == 200
        assert "expiresAt" in response.data
        returned = decode_viewer_context(response.data["viewerContext"])
        assert returned.organization_id == self.organization.id
        assert returned.user_id is None

    def test_rejects_viewer_context_for_other_org(self) -> None:
        other_org = self.create_organization()

        response = self._post(ViewerContext(organization_id=other_org.id))

        assert response.status_code == 403

    def test_rejects_viewer_context_with_user(self) -> None:
        response = self._post(
            ViewerContext(organization_id=self.organization.id, user_id=self.user.id)
        )

        assert response.status_code == 403

    def test_rejects_session_user(self) -> None:
        self.login_as(self.user)
        url = reverse(self.endpoint, args=[self.organization.slug, "7"])

        with self.feature(FEATURE_FLAG):
            response = self.client.post(url)

        assert response.status_code == 403
