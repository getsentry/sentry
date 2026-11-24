from django.urls import reverse
from django.utils import timezone

from sentry.service_accounts.auth import (
    SERVICE_ACCOUNT_TOKEN_KIND,
    authenticate_service_account,
    resolve_service_account,
)
from sentry.service_accounts.models import ServiceAccountToken
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.service_accounts.tokens import generate_token, stored_token_fields
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.viewer_context import Actor, ActorType, ViewerContext


class ResolveServiceAccountTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.service_account = self.create_service_account(
            organization=self.organization, scope_list=["project:read", "event:read"]
        )

    def assert_resolves(self) -> None:
        result = resolve_service_account(self.service_account.id, self.organization.id)

        assert result is not None
        principal, token = result
        assert principal == ServiceAccountPrincipal(
            service_account_id=self.service_account.id,
            organization_id=self.organization.id,
            name=self.service_account.name,
        )
        assert token.kind == SERVICE_ACCOUNT_TOKEN_KIND
        assert token.entity_id == self.service_account.id
        assert token.organization_id == self.organization.id
        assert token.scopes == ["event:read", "project:read"]

    @with_feature("organizations:service-accounts")
    def test_resolves_in_cell(self) -> None:
        self.assert_resolves()

    @with_feature("organizations:service-accounts")
    def test_resolves_in_control(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            self.assert_resolves()

    def test_without_feature_returns_none(self) -> None:
        assert resolve_service_account(self.service_account.id, self.organization.id) is None
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            assert resolve_service_account(self.service_account.id, self.organization.id) is None

    @with_feature("organizations:service-accounts")
    def test_other_org_returns_none(self) -> None:
        other_org = self.create_organization()

        assert resolve_service_account(self.service_account.id, other_org.id) is None
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            assert resolve_service_account(self.service_account.id, other_org.id) is None

    @with_feature("organizations:service-accounts")
    def test_deleted_account_returns_none(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            assert self.service_account.deactivate()

        assert resolve_service_account(self.service_account.id, self.organization.id) is None
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            assert resolve_service_account(self.service_account.id, self.organization.id) is None

    @with_feature("organizations:service-accounts")
    def test_viewer_context_resolves_the_same_account(self) -> None:
        vc = ViewerContext(
            actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=self.service_account.id),
            organization_id=self.organization.id,
        )

        assert authenticate_service_account(vc) == resolve_service_account(
            self.service_account.id, self.organization.id
        )

    @with_feature("organizations:service-accounts")
    def test_viewer_context_for_a_user_returns_none(self) -> None:
        vc = ViewerContext(
            actor=Actor(type=ActorType.USER, actor_id=self.service_account.id),
            organization_id=self.organization.id,
        )

        assert authenticate_service_account(vc) is None


@with_feature("organizations:service-accounts")
class ServiceAccountTokenRequestTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.service_account = self.create_service_account(
            organization=self.organization,
            scope_list=["org:read", "project:read"],
            project_ids=[self.project.id],
        )
        self.create_project(organization=self.organization)
        self.url = reverse(
            "sentry-api-0-organization-projects",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def create_token(self, scope_list: list[str]) -> tuple[str, ServiceAccountToken]:
        token_str = generate_token(self.organization.slug, "https://test-region.sentry.io")
        stored = stored_token_fields(token_str)
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            token = ServiceAccountToken.objects.create(
                service_account=self.service_account,
                organization_id=self.organization.id,
                name="ci",
                token_hashed=stored.token_hashed,
                token_last_characters=stored.token_last_characters,
                scope_list=scope_list,
                created_by=self.user,
            )
        return token_str, token

    def test_token_reaches_only_the_accounts_projects(self) -> None:
        token_str, _ = self.create_token(["org:read", "project:read"])

        response = self.client.get(self.url, HTTP_AUTHORIZATION=f"Bearer {token_str}")

        assert response.status_code == 200, response.content
        assert [project["id"] for project in response.data] == [str(self.project.id)]

    def test_token_scopes_limit_the_account(self) -> None:
        token_str, _ = self.create_token(["project:read"])

        response = self.client.get(self.url, HTTP_AUTHORIZATION=f"Bearer {token_str}")

        assert response.status_code == 403

    def test_revoked_token_is_rejected(self) -> None:
        token_str, token = self.create_token(["org:read", "project:read"])
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            token.update(date_deactivated=timezone.now())

        response = self.client.get(self.url, HTTP_AUTHORIZATION=f"Bearer {token_str}")

        assert response.status_code == 401

    def test_token_is_not_a_browser_login(self) -> None:
        token_str, _ = self.create_token(["org:read", "project:read"])

        response = self.client.post(
            reverse("sentry-account-confirm-email-send"),
            {"primary-email": "1", "email": "admin@example.com"},
            HTTP_AUTHORIZATION=f"Bearer {token_str}",
        )

        assert response.status_code == 302
        assert response["Location"].startswith("/auth/login/")
