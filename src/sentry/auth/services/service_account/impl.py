from __future__ import annotations

from datetime import datetime

from django.db import router, transaction
from django.db.utils import IntegrityError

from sentry.auth.services.service_account import (
    RpcServiceAccount,
    RpcServiceAccountCreation,
    RpcServiceAccountDetail,
    RpcServiceAccountTokenCreation,
    ServiceAccountService,
)
from sentry.auth.services.service_account.serial import (
    serialize_service_account,
    serialize_service_account_token,
)
from sentry.models.apitoken import ApiToken
from sentry.models.serviceaccount import ServiceAccount
from sentry.silo.safety import unguarded_write
from sentry.types.token import AuthTokenType


class DatabaseBackedServiceAccountService(ServiceAccountService):
    def _get_account(
        self, *, organization_id: int, service_account_id: int
    ) -> ServiceAccount | None:
        return ServiceAccount.objects.filter(
            id=service_account_id, organization_id=organization_id
        ).first()

    def _serialize_detail(
        self, account: ServiceAccount, tokens: list[ApiToken]
    ) -> RpcServiceAccountDetail:
        return RpcServiceAccountDetail(
            account=serialize_service_account(account),
            tokens=[serialize_service_account_token(token) for token in tokens],
        )

    def _create_token(
        self,
        *,
        account: ServiceAccount,
        name: str,
        scopes: list[str],
        expires_at: datetime | None,
    ) -> RpcServiceAccountTokenCreation:
        token = ApiToken.objects.create(
            service_account=account,
            application=None,
            name=name,
            scope_list=scopes,
            token_type=AuthTokenType.USER,
            refresh_token=None,
            expires_at=expires_at,
        )
        plaintext = token.plaintext_token
        return RpcServiceAccountTokenCreation(
            token=plaintext,
            token_metadata=serialize_service_account_token(token),
        )

    def create(
        self,
        *,
        organization_id: int,
        name: str,
        token_name: str,
        scopes: list[str],
        expires_at: datetime | None,
    ) -> RpcServiceAccountCreation | None:
        try:
            with transaction.atomic(using=router.db_for_write(ServiceAccount)):
                account = ServiceAccount.objects.create(
                    organization_id=organization_id,
                    name=name,
                    is_active=True,
                )
                created_token = self._create_token(
                    account=account,
                    name=token_name,
                    scopes=scopes,
                    expires_at=expires_at,
                )
        except IntegrityError:
            return None
        return RpcServiceAccountCreation(
            account=serialize_service_account(account),
            token=created_token.token,
            token_metadata=created_token.token_metadata,
        )

    def get(
        self, *, organization_id: int, service_account_id: int
    ) -> RpcServiceAccountDetail | None:
        account = self._get_account(
            organization_id=organization_id, service_account_id=service_account_id
        )
        if account is None:
            return None
        tokens = list(ApiToken.objects.filter(service_account=account).order_by("date_added", "id"))
        return self._serialize_detail(account, tokens)

    def get_for_token(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        token_id: int,
    ) -> RpcServiceAccount | None:
        account = ServiceAccount.objects.filter(
            id=service_account_id,
            organization_id=organization_id,
            is_active=True,
            api_tokens__id=token_id,
        ).first()
        return serialize_service_account(account) if account is not None else None

    def list_accounts(self, *, organization_id: int) -> list[RpcServiceAccountDetail]:
        accounts = list(
            ServiceAccount.objects.filter(organization_id=organization_id).order_by("name", "id")
        )
        tokens_by_account: dict[int, list[ApiToken]] = {account.id: [] for account in accounts}
        for token in ApiToken.objects.filter(service_account_id__in=tokens_by_account).order_by(
            "date_added", "id"
        ):
            assert token.service_account_id is not None
            tokens_by_account[token.service_account_id].append(token)
        return [
            self._serialize_detail(account, tokens_by_account[account.id]) for account in accounts
        ]

    def update(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        name: str | None,
        is_active: bool | None,
    ) -> RpcServiceAccount | None:
        account = self._get_account(
            organization_id=organization_id, service_account_id=service_account_id
        )
        if account is None:
            return None

        update_fields = ["date_updated"]
        if name is not None:
            account.name = name
            update_fields.append("name")
        if is_active is not None:
            account.is_active = is_active
            update_fields.append("is_active")
        account.save(update_fields=update_fields)

        return serialize_service_account(account)

    def delete(self, *, organization_id: int, service_account_id: int) -> bool:
        account = self._get_account(
            organization_id=organization_id, service_account_id=service_account_id
        )
        if account is None:
            return False
        with transaction.atomic(using=router.db_for_write(ServiceAccount)):
            for token in ApiToken.objects.filter(service_account=account):
                token.delete()
            # The account has no cell replica of its own. Its control-side member
            # mapping is a cache of the cell membership and may be removed here;
            # the endpoint separately deletes the source membership and emits its
            # normal idempotent mapping tombstone.
            with unguarded_write(using=router.db_for_write(ServiceAccount)):
                account.delete()
        return True

    def create_token(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        name: str,
        scopes: list[str],
        expires_at: datetime | None,
    ) -> RpcServiceAccountTokenCreation | None:
        account = self._get_account(
            organization_id=organization_id, service_account_id=service_account_id
        )
        if account is None:
            return None
        return self._create_token(
            account=account,
            name=name,
            scopes=scopes,
            expires_at=expires_at,
        )

    def delete_token(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        token_id: int,
    ) -> bool:
        token = ApiToken.objects.filter(
            id=token_id,
            service_account_id=service_account_id,
            service_account__organization_id=organization_id,
        ).first()
        if token is None:
            return False
        token.delete()
        return True
