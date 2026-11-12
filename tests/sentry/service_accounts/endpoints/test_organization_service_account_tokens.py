from typing import Any
from unittest import mock

from django.urls import reverse
from rest_framework.authentication import BaseAuthentication
from rest_framework.request import Request

from sentry.auth.services.auth import AuthenticatedToken
from sentry.service_accounts.auth import SERVICE_ACCOUNT_TOKEN_KIND
from sentry.service_accounts.endpoints.organization_service_account_tokens import (
    OrganizationServiceAccountTokenIndexEndpoint,
)
from sentry.service_accounts.models import ServiceAccount, ServiceAccountToken
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.service_accounts.tokens import stored_token_fields
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

FEATURE_FLAG = "organizations:service-accounts"


class ServiceAccountTokenTestCase(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.service_account = self.create_service_account(
            organization=self.organization,
            name="ci",
            scope_list=["org:read", "project:read", "project:releases"],
        )

    def create_token(
        self,
        service_account: ServiceAccount | None = None,
        name: str = "deploys",
        **kwargs: Any,
    ) -> ServiceAccountToken:
        service_account = service_account or self.service_account
        stored = stored_token_fields(f"plaintext-{name}-{ServiceAccountToken.objects.count()}")
        return ServiceAccountToken.objects.create(
            service_account=service_account,
            organization_id=service_account.organization_id,
            name=name,
            token_hashed=stored.token_hashed,
            token_last_characters=stored.token_last_characters,
            scope_list=["project:read"],
            created_by=self.user,
            **kwargs,
        )

    def login_as_role(self, role: str) -> None:
        user = self.create_user()
        self.create_member(organization=self.organization, user=user, role=role)
        self.login_as(user)


class ServiceAccountAuthentication(BaseAuthentication):
    def authenticate(self, request: Request) -> tuple[Any, AuthenticatedToken]:
        principal = ServiceAccountPrincipal(service_account_id=1, organization_id=1, name="sa")
        token = AuthenticatedToken(
            kind=SERVICE_ACCOUNT_TOKEN_KIND,
            entity_id=1,
            organization_id=1,
            scopes=["service_account:read", "service_account:write"],
        )
        return (principal, token)


@control_silo_test
class OrganizationServiceAccountTokenIndexTest(ServiceAccountTokenTestCase):
    endpoint = "sentry-api-0-organization-service-account-tokens"

    def test_flag_off_returns_404(self) -> None:
        self.get_error_response(self.organization.slug, self.service_account.id, status_code=404)

    def test_list_returns_active_tokens_newest_first(self) -> None:
        older = self.create_token(name="older")
        newer = self.create_token(name="newer")
        self.create_token(name="revoked", date_deactivated=older.date_added)
        other_account = self.create_service_account(organization=self.organization, name="other")
        self.create_token(service_account=other_account, name="other-account")

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug, self.service_account.id)

        assert [row["name"] for row in response.data] == ["newer", "older"]
        assert response.data[0] == {
            "id": str(newer.id),
            "name": "newer",
            "scopes": ["project:read"],
            "tokenLastCharacters": newer.token_last_characters,
            "dateCreated": newer.date_added,
            "dateLastUsed": None,
            "dateExpires": None,
        }

    def test_member_can_list(self) -> None:
        self.create_token()
        self.login_as_role("member")

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug, self.service_account.id)

        assert len(response.data) == 1

    def test_service_account_caller_cannot_list(self) -> None:
        url = reverse(self.endpoint, args=[self.organization.slug, self.service_account.id])

        with (
            self.feature(FEATURE_FLAG),
            mock.patch.object(
                OrganizationServiceAccountTokenIndexEndpoint,
                "authentication_classes",
                (ServiceAccountAuthentication,),
            ),
        ):
            response = self.client.get(url)

        assert response.status_code == 403
        assert response.data["detail"]["code"] == "user-required"

    def test_other_org_returns_404(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            other_organization = self.create_organization()
        other = self.create_service_account(organization=other_organization, name="other")
        self.create_token(service_account=other)

        with self.feature(FEATURE_FLAG):
            self.get_error_response(self.organization.slug, other.id, status_code=404)

    def test_deleted_account_returns_404(self) -> None:
        self.service_account.deactivate()

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug, self.service_account.id, status_code=404
            )
