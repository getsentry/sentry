from datetime import UTC, datetime

from django.urls import reverse

from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

FEATURE_FLAG = "organizations:service-accounts"


@control_silo_test
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
                "dateCreated": datetime(2025, 1, 1, tzinfo=UTC),
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


@control_silo_test
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
