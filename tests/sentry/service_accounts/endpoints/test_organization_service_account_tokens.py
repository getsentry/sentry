from datetime import timedelta
from typing import Any
from unittest import mock

from django.urls import reverse
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.request import Request

from sentry import audit_log
from sentry.auth.services.auth import AuthenticatedToken
from sentry.models.auditlogentry import AuditLogEntry
from sentry.seer.agent_token import AGENT_TOKEN_KIND
from sentry.service_accounts.auth import SERVICE_ACCOUNT_TOKEN_KIND
from sentry.service_accounts.endpoints.organization_service_account_tokens import (
    DisallowAgentTokenWrites,
    OrganizationServiceAccountTokenIndexEndpoint,
)
from sentry.service_accounts.models import (
    ServiceAccount,
    ServiceAccountToken,
    ServiceAccountTokenReplica,
)
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.service_accounts.tokens import (
    SERVICE_ACCOUNT_TOKEN_PREFIX,
    parse_token,
    stored_token_fields,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
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

    @freeze_time("2026-11-09 12:00:00")
    def test_create(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="post",
                name="deploys",
                scopes=["project:releases", "project:read", "project:read"],
                status_code=201,
            )

        token = ServiceAccountToken.objects.get(id=response.data["id"])
        plaintext = response.data["token"]
        assert plaintext.startswith(SERVICE_ACCOUNT_TOKEN_PREFIX)
        parsed = parse_token(plaintext)
        assert parsed is not None
        assert parsed["org"] == self.organization.slug
        assert token.token_hashed == stored_token_fields(plaintext).token_hashed
        assert token.token_hashed != plaintext
        assert token.service_account_id == self.service_account.id
        assert token.organization_id == self.organization.id
        assert token.scope_list == ["project:read", "project:releases"]
        assert token.created_by_id == self.user.id
        assert token.date_expires == timezone.now() + timedelta(days=30)
        assert token.date_deactivated is None
        assert response.data == {
            "id": str(token.id),
            "name": "deploys",
            "scopes": ["project:read", "project:releases"],
            "tokenLastCharacters": plaintext[-4:],
            "dateCreated": token.date_added,
            "dateLastUsed": None,
            "dateExpires": token.date_expires,
            "token": plaintext,
        }

        entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("SERVICE_ACCOUNT_TOKEN_ADD"))
        assert entry.organization_id == self.organization.id
        assert entry.actor_id == self.user.id
        assert entry.target_object == token.id
        assert entry.data == {
            "name": "deploys",
            "scopes": ["project:read", "project:releases"],
            "service_account_id": self.service_account.id,
            "service_account_name": "ci",
        }

        # The plaintext is never returned again.
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug, self.service_account.id)
        assert "token" not in response.data[0]
        assert plaintext not in str(response.content)

    @freeze_time("2026-11-09 12:00:00")
    def test_create_replicates_token_to_cell(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="post",
                name="deploys",
                scopes=["project:read"],
                status_code=201,
            )

        with assume_test_silo_mode(SiloMode.CELL):
            assert ServiceAccountTokenReplica.objects.filter(
                token_id=int(response.data["id"])
            ).exists()

    def test_create_returns_token_when_outbox_flush_fails(self) -> None:
        with (
            self.feature(FEATURE_FLAG),
            mock.patch(
                "sentry.service_accounts.models.ServiceAccountToken.handle_async_replication",
                side_effect=Exception("cell unavailable"),
            ),
        ):
            response = self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="post",
                name="deploys",
                scopes=["project:read"],
                status_code=201,
            )

        assert response.data["token"].startswith(SERVICE_ACCOUNT_TOKEN_PREFIX)
        assert ServiceAccountToken.objects.filter(id=response.data["id"]).exists()
        with assume_test_silo_mode(SiloMode.CELL):
            assert not ServiceAccountTokenReplica.objects.filter(
                token_id=int(response.data["id"])
            ).exists()

    def test_create_with_expiration(self) -> None:
        expires_at = timezone.now() + timedelta(days=30)
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="post",
                name="deploys",
                scopes=["project:read"],
                expiresAt=expires_at.isoformat(),
                status_code=201,
            )

        token = ServiceAccountToken.objects.get(id=response.data["id"])
        assert token.date_expires == expires_at
        assert response.data["dateExpires"] == expires_at

    def test_create_with_null_expiration_never_expires(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="post",
                name="deploys",
                scopes=["project:read"],
                expiresAt=None,
                status_code=201,
            )

        assert ServiceAccountToken.objects.get(id=response.data["id"]).date_expires is None

    @freeze_time("2026-11-09 12:00:00")
    def test_create_rejects_past_expiration(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                method="post",
                name="deploys",
                scopes=["project:read"],
                expiresAt=(timezone.now() - timedelta(minutes=1)).isoformat(),
                status_code=400,
            )

        assert set(response.data["detail"]) == {"expiresAt"}
        assert not ServiceAccountToken.objects.exists()

    def test_create_rejects_scopes_the_account_lacks(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                method="post",
                name="deploys",
                scopes=["project:read", "org:write"],
                status_code=400,
            )

        assert "scopes" in response.data["detail"]
        assert not ServiceAccountToken.objects.exists()

    def test_create_rejects_scopes_the_caller_lacks(self) -> None:
        service_account = self.create_service_account(
            organization=self.organization, name="admin-bot", scope_list=["org:admin", "org:read"]
        )
        self.login_as_role("manager")

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                service_account.id,
                method="post",
                name="deploys",
                scopes=["org:read", "org:admin"],
                status_code=400,
            )

        assert response.data["detail"]["scopes"] == [
            "You can't grant scopes you don't have: org:admin"
        ]
        assert not ServiceAccountToken.objects.exists()

    def test_create_requires_name_and_scopes(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                method="post",
                scopes=[],
                status_code=400,
            )

        assert set(response.data["detail"]) == {"name", "scopes"}
        assert not ServiceAccountToken.objects.exists()

    def test_create_requires_service_account_write(self) -> None:
        self.login_as_role("member")

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                method="post",
                name="deploys",
                scopes=["project:read"],
                status_code=403,
            )

        assert not ServiceAccountToken.objects.exists()

    def test_manager_can_create(self) -> None:
        self.login_as_role("manager")

        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="post",
                name="deploys",
                scopes=["project:read"],
                status_code=201,
            )

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

    def test_service_account_caller_cannot_create(self) -> None:
        url = reverse(self.endpoint, args=[self.organization.slug, self.service_account.id])

        with (
            self.feature(FEATURE_FLAG),
            mock.patch.object(
                OrganizationServiceAccountTokenIndexEndpoint,
                "authentication_classes",
                (ServiceAccountAuthentication,),
            ),
        ):
            response = self.client.post(
                url, data={"name": "deploys", "scopes": ["project:read"]}, format="json"
            )

        assert response.status_code == 403
        assert response.data["detail"]["code"] == "user-required"
        assert not ServiceAccountToken.objects.exists()

    def test_other_org_returns_404(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            other_organization = self.create_organization()
        other = self.create_service_account(organization=other_organization, name="other")
        self.create_token(service_account=other)

        with self.feature(FEATURE_FLAG):
            self.get_error_response(self.organization.slug, other.id, status_code=404)

    def test_create_for_other_org_returns_404(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            other_organization = self.create_organization()
        other = self.create_service_account(organization=other_organization, name="other")

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug,
                other.id,
                method="post",
                name="deploys",
                scopes=["org:read"],
                status_code=404,
            )

        assert not ServiceAccountToken.objects.filter(service_account=other).exists()

    def test_deleted_account_returns_404(self) -> None:
        self.service_account.deactivate()

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug, self.service_account.id, status_code=404
            )


@control_silo_test
class OrganizationServiceAccountTokenDetailsTest(ServiceAccountTokenTestCase):
    endpoint = "sentry-api-0-organization-service-account-token-details"
    method = "delete"

    def setUp(self) -> None:
        super().setUp()
        self.token = self.create_token()

    def test_revoke(self) -> None:
        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug, self.service_account.id, self.token.id, status_code=204
            )

        self.token.refresh_from_db()
        assert self.token.date_deactivated is not None
        with assume_test_silo_mode(SiloMode.CELL):
            replica = ServiceAccountTokenReplica.objects.get(token_id=self.token.id)
        assert replica.date_deactivated == self.token.date_deactivated

        entry = AuditLogEntry.objects.get(
            event=audit_log.get_event_id("SERVICE_ACCOUNT_TOKEN_REMOVE")
        )
        assert entry.actor_id == self.user.id
        assert entry.target_object == self.token.id
        assert entry.data == {
            "name": "deploys",
            "scopes": ["project:read"],
            "service_account_id": self.service_account.id,
            "service_account_name": "ci",
        }

    def test_revoke_succeeds_when_outbox_flush_fails(self) -> None:
        with (
            self.feature(FEATURE_FLAG),
            mock.patch(
                "sentry.service_accounts.models.ServiceAccountToken.handle_async_replication",
                side_effect=Exception("cell unavailable"),
            ),
        ):
            self.get_success_response(
                self.organization.slug, self.service_account.id, self.token.id, status_code=204
            )

        self.token.refresh_from_db()
        assert self.token.date_deactivated is not None

    def test_revoked_token_returns_404(self) -> None:
        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug, self.service_account.id, self.token.id, status_code=204
            )
            self.get_error_response(
                self.organization.slug, self.service_account.id, self.token.id, status_code=404
            )

        assert (
            AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("SERVICE_ACCOUNT_TOKEN_REMOVE")
            ).count()
            == 1
        )

    def test_token_of_other_account_returns_404(self) -> None:
        other_account = self.create_service_account(organization=self.organization, name="other")

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug, other_account.id, self.token.id, status_code=404
            )

        self.token.refresh_from_db()
        assert self.token.date_deactivated is None

    def test_token_of_other_org_returns_404(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            other_organization = self.create_organization(owner=self.user)
        other_account = self.create_service_account(organization=other_organization, name="ci")
        other_token = self.create_token(service_account=other_account)

        with self.feature(FEATURE_FLAG):
            # The URL's org owns neither the account nor the token.
            self.get_error_response(
                self.organization.slug, other_account.id, other_token.id, status_code=404
            )
            # The URL's account is in the org, but the token isn't.
            self.get_error_response(
                self.organization.slug, self.service_account.id, other_token.id, status_code=404
            )

        other_token.refresh_from_db()
        assert other_token.date_deactivated is None

    def test_revoke_requires_service_account_write(self) -> None:
        self.login_as_role("member")

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug, self.service_account.id, self.token.id, status_code=403
            )

        self.token.refresh_from_db()
        assert self.token.date_deactivated is None

    def test_manager_can_revoke(self) -> None:
        self.login_as_role("manager")

        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug, self.service_account.id, self.token.id, status_code=204
            )


@control_silo_test
class DisallowAgentTokenWritesTest(TestCase):
    def check(self, method: str, kind: str) -> bool:
        request = mock.Mock(method=method, auth=AuthenticatedToken(kind=kind, user_id=self.user.id))
        return DisallowAgentTokenWrites().has_permission(request, view=None)

    def test_rejects_agent_writes(self) -> None:
        assert not self.check("POST", AGENT_TOKEN_KIND)
        assert not self.check("DELETE", AGENT_TOKEN_KIND)

    def test_allows_agent_reads_and_other_writes(self) -> None:
        assert self.check("GET", AGENT_TOKEN_KIND)
        assert self.check("POST", "api_token")
