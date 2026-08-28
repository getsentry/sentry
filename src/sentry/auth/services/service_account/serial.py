from __future__ import annotations

from sentry.auth.services.service_account import RpcServiceAccount, RpcServiceAccountToken
from sentry.models.apitoken import ApiToken
from sentry.models.serviceaccount import ServiceAccount


def serialize_service_account(account: ServiceAccount) -> RpcServiceAccount:
    return RpcServiceAccount(
        id=account.id,
        organization_id=account.organization_id,
        name=account.name,
        is_active=account.is_active,
        date_added=account.date_added,
        date_updated=account.date_updated,
    )


def serialize_service_account_token(token: ApiToken) -> RpcServiceAccountToken:
    return RpcServiceAccountToken(
        id=token.id,
        name=token.name,
        scopes=token.get_scopes(),
        expires_at=token.expires_at,
        token_last_characters=token.token_last_characters,
    )
