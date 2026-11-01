from datetime import timedelta

from django.utils import timezone

from sentry.service_accounts.tokens import (
    SERVICE_ACCOUNT_TOKEN_PREFIX,
    decode_service_account_token,
    encode_service_account_token,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test

FEATURE_FLAG = "organizations:service-accounts"


@control_silo_test
class OrganizationServiceAccountTokenTest(APITestCase):
    endpoint = "sentry-api-0-organization-service-account-tokens"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.service_account = self.create_service_account(
            organization=self.organization, scope_list=["project:read", "event:read"]
        )
        self.login_as(self.user)

    def test_owner_mints_token(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug, self.service_account.id, status_code=201
            )

        token = response.data["token"]
        assert token.startswith(SERVICE_ACCOUNT_TOKEN_PREFIX)
        assert decode_service_account_token(token) == (
            self.service_account.id,
            self.organization.id,
        )
        assert response.data["scopes"] == ["event:read", "project:read"]
        expires_in = response.data["expiresAt"] - timezone.now()
        assert timedelta(hours=23) < expires_in <= timedelta(hours=24)

    def test_expires_in(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug, self.service_account.id, expiresIn=600, status_code=201
            )

        assert response.data["expiresAt"] - timezone.now() <= timedelta(minutes=10)

    def test_expires_in_over_max(self) -> None:
        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                expiresIn=int(timedelta(days=31).total_seconds()),
                status_code=400,
            )

    def test_inactive_account_returns_404(self) -> None:
        inactive = self.create_service_account(
            organization=self.organization, name="nightly-triage", is_active=False
        )
        with self.feature(FEATURE_FLAG):
            self.get_error_response(self.organization.slug, inactive.id, status_code=404)

    def test_account_in_other_org_returns_404(self) -> None:
        other = self.create_service_account(organization=self.create_organization())
        with self.feature(FEATURE_FLAG):
            self.get_error_response(self.organization.slug, other.id, status_code=404)

    def test_member_cannot_mint(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)
        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug, self.service_account.id, status_code=403
            )

    def test_service_account_cannot_mint(self) -> None:
        token, _ = encode_service_account_token(
            service_account_id=self.service_account.id, organization_id=self.organization.id
        )
        self.client.logout()
        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                status_code=401,
                extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token}"},
            )

    def test_flag_off_returns_404(self) -> None:
        self.get_error_response(self.organization.slug, self.service_account.id, status_code=404)
