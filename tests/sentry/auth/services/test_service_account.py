from __future__ import annotations

import hashlib

import pytest
from django.test import RequestFactory
from rest_framework.exceptions import AuthenticationFailed

from sentry.api.authentication import UserAuthTokenAuthentication
from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.services.auth.serial import serialize_api_token
from sentry.auth.services.service_account import RpcServiceAccount, service_account_service
from sentry.hybridcloud.models import ApiTokenReplica
from sentry.hybridcloud.rpc.service import dispatch_to_local_service
from sentry.hybridcloud.services.replica import cell_replica_service
from sentry.models.apitoken import ApiToken
from sentry.models.serviceaccount import ServiceAccount
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.requests import drf_request_from_request
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_cells


@all_silo_test(cells=create_test_cells("us"))
class ServiceAccountServiceTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.create_user())

    def _create(self, name: str = "Deploy bot"):
        created = service_account_service.create(
            organization_id=self.organization.id,
            name=name,
            token_name="Production",
            scopes=["org:read", "project:read"],
            expires_at=None,
        )
        assert created is not None
        return created

    def _authenticate_in_cell(self, token: str):
        request = drf_request_from_request(RequestFactory().get("/api/0/organizations/"))
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        with assume_test_silo_mode(SiloMode.CELL, can_be_monolith=False):
            return UserAuthTokenAuthentication().authenticate(request)

    def test_crud_and_rpc_model_accuracy(self) -> None:
        created = self._create()

        with assume_test_silo_mode(SiloMode.CONTROL):
            account = ServiceAccount.objects.get(id=created.account.id)
            token = ApiToken.objects.get(id=created.token_metadata.id)

        assert created.account.id == account.id
        assert created.account.organization_id == account.organization_id
        assert created.account.name == account.name
        assert created.account.is_active == account.is_active
        assert created.account.date_added == account.date_added
        assert created.account.date_updated == account.date_updated
        assert created.token_metadata.name == token.name
        assert created.token_metadata.scopes == token.get_scopes()
        assert created.token_metadata.expires_at == token.expires_at
        assert created.token_metadata.token_last_characters == token.token_last_characters
        assert token.hashed_token == hashlib.sha256(created.token.encode()).hexdigest()
        assert token.user_id is None

        detail = service_account_service.get(
            organization_id=self.organization.id,
            service_account_id=created.account.id,
        )
        assert detail is not None
        assert detail.account == created.account
        assert [item.id for item in detail.tokens] == [created.token_metadata.id]
        assert (
            service_account_service.get_for_token(
                organization_id=self.organization.id,
                service_account_id=created.account.id,
                token_id=created.token_metadata.id,
            )
            == created.account
        )
        assert [
            item.account.id
            for item in service_account_service.list_accounts(organization_id=self.organization.id)
        ] == [created.account.id]

        updated = service_account_service.update(
            organization_id=self.organization.id,
            service_account_id=created.account.id,
            name="Release bot",
            is_active=False,
        )
        assert updated is not None
        assert updated.name == "Release bot"
        assert not updated.is_active

        rotated = service_account_service.create_token(
            organization_id=self.organization.id,
            service_account_id=created.account.id,
            name="Rotated",
            scopes=["org:read"],
            expires_at=None,
        )
        assert rotated is not None
        assert service_account_service.delete_token(
            organization_id=self.organization.id,
            service_account_id=created.account.id,
            token_id=rotated.token_metadata.id,
        )
        assert service_account_service.delete(
            organization_id=self.organization.id,
            service_account_id=created.account.id,
        )
        assert (
            service_account_service.get(
                organization_id=self.organization.id,
                service_account_id=created.account.id,
            )
            is None
        )

    def test_not_found_and_wrong_organization_are_isolated(self) -> None:
        created = self._create()
        other = self.create_organization(owner=self.create_user())

        assert (
            service_account_service.get(
                organization_id=other.id,
                service_account_id=created.account.id,
            )
            is None
        )
        assert (
            service_account_service.update(
                organization_id=other.id,
                service_account_id=created.account.id,
                name="Wrong organization",
                is_active=None,
            )
            is None
        )
        assert not service_account_service.delete_token(
            organization_id=other.id,
            service_account_id=created.account.id,
            token_id=created.token_metadata.id,
        )

    def test_serialization_round_trip(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            response = dispatch_to_local_service(
                "service_account",
                "create",
                {
                    "organization_id": self.organization.id,
                    "name": "Round trip bot",
                    "token_name": "Default",
                    "scopes": ["org:read"],
                    "expires_at": None,
                },
            )

        value = response["value"]
        assert value["account"]["name"] == "Round trip bot"
        assert value["account"]["organization_id"] == self.organization.id
        assert value["token_metadata"]["scopes"] == ["org:read"]
        assert value["token"].startswith("sntryu_")

    def test_token_replica_and_authoritative_actor_lifecycle(self) -> None:
        with outbox_runner():
            created = self._create()

        with assume_test_silo_mode(SiloMode.CELL):
            replica = ApiTokenReplica.objects.get(apitoken_id=created.token_metadata.id)
            assert replica.service_account_id == created.account.id
            assert replica.user_id is None
            assert replica.organization_id == self.organization.id
            assert replica.scoping_organization_id is None

        updated = service_account_service.update(
            organization_id=self.organization.id,
            service_account_id=created.account.id,
            name="Disabled bot",
            is_active=False,
        )
        assert updated is not None
        assert (
            service_account_service.get_for_token(
                organization_id=self.organization.id,
                service_account_id=created.account.id,
                token_id=created.token_metadata.id,
            )
            is None
        )

        with outbox_runner():
            assert service_account_service.delete_token(
                organization_id=self.organization.id,
                service_account_id=created.account.id,
                token_id=created.token_metadata.id,
            )

        with assume_test_silo_mode(SiloMode.CELL):
            assert not ApiTokenReplica.objects.filter(
                apitoken_id=created.token_metadata.id
            ).exists()

    def test_cell_bearer_authenticates_active_account_with_token_scopes(self) -> None:
        with outbox_runner():
            created = self._create()

        result = self._authenticate_in_cell(created.token)

        assert result is not None
        account, auth = result
        assert isinstance(account, RpcServiceAccount)
        assert account.id == created.account.id
        assert account.organization_id == self.organization.id
        assert isinstance(auth, AuthenticatedToken)
        assert auth is not None
        assert auth.actor_type == "service_account"
        assert auth.actor_id == created.account.id
        assert auth.organization_id == self.organization.id
        assert auth.get_scopes() == ["org:read", "project:read"]

    def test_cell_bearer_rejects_disabled_account(self) -> None:
        with outbox_runner():
            created = self._create()
        updated = service_account_service.update(
            organization_id=self.organization.id,
            service_account_id=created.account.id,
            name=None,
            is_active=False,
        )
        assert updated is not None

        with pytest.raises(
            AuthenticationFailed, match="Service account or token inactive or deleted"
        ):
            self._authenticate_in_cell(created.token)

    def test_cell_bearer_rejects_revoked_token_with_stale_replica(self) -> None:
        with outbox_runner():
            created = self._create()
        with assume_test_silo_mode(SiloMode.CONTROL):
            replicated_token = serialize_api_token(
                ApiToken.objects.get(id=created.token_metadata.id)
            )
        assert service_account_service.delete_token(
            organization_id=self.organization.id,
            service_account_id=created.account.id,
            token_id=created.token_metadata.id,
        )
        with assume_test_silo_mode(SiloMode.CELL, can_be_monolith=False):
            cell_replica_service.upsert_replicated_api_token(
                api_token=replicated_token,
                cell_name="us",
            )
            assert ApiTokenReplica.objects.filter(apitoken_id=created.token_metadata.id).exists()

        with pytest.raises(
            AuthenticationFailed, match="Service account or token inactive or deleted"
        ):
            self._authenticate_in_cell(created.token)
