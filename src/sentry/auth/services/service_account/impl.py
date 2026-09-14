from __future__ import annotations

from datetime import datetime

from django.db import router, transaction
from django.db.utils import IntegrityError

from sentry.auth.services.service_account.model import (
    RpcServiceAccount,
    RpcServiceAccountCreation,
    RpcServiceAccountToken,
)
from sentry.auth.services.service_account.serial import serialize_service_account
from sentry.auth.services.service_account.service import ServiceAccountService
from sentry.models.apitoken import ApiToken
from sentry.models.serviceaccount import ServiceAccount
from sentry.silo.safety import unguarded_write
from sentry.types.token import AuthTokenType


class DatabaseBackedServiceAccountService(ServiceAccountService):
    def create(
        self,
        *,
        organization_id: int,
        name: str,
        scopes: list[str],
        expires_at: datetime | None,
    ) -> RpcServiceAccountCreation | None:
        try:
            with transaction.atomic(using=router.db_for_write(ServiceAccount)):
                account = ServiceAccount.objects.create(
                    organization_id=organization_id,
                    name=name,
                )
                token = ApiToken.objects.create(
                    service_account=account,
                    application=None,
                    name=f"{name} PoC token",
                    scope_list=scopes,
                    token_type=AuthTokenType.USER,
                    refresh_token=None,
                    expires_at=expires_at,
                )
        except IntegrityError:
            return None

        return RpcServiceAccountCreation(
            account=serialize_service_account(account),
            token=RpcServiceAccountToken(id=token.id, token=token.plaintext_token),
        )

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
        if account is None:
            return None
        return serialize_service_account(account)

    def delete(self, *, organization_id: int, service_account_id: int) -> bool:
        account = ServiceAccount.objects.filter(
            id=service_account_id,
            organization_id=organization_id,
        ).first()
        if account is None:
            return False
        with transaction.atomic(using=router.db_for_write(ServiceAccount)):
            for token in ApiToken.objects.filter(service_account=account):
                token.delete()
            with unguarded_write(using=router.db_for_write(ServiceAccount)):
                account.delete()
        return True
