from __future__ import annotations

from collections.abc import Iterable

from sentry.service_accounts.models import ServiceAccount, ServiceAccountToken
from sentry.service_accounts.services.service_account.model import (
    RpcServiceAccount,
    RpcServiceAccountToken,
)


def serialize_service_account(
    service_account: ServiceAccount, project_ids: Iterable[int]
) -> RpcServiceAccount:
    return RpcServiceAccount(
        id=service_account.id,
        organization_id=service_account.organization_id,
        name=service_account.name,
        scope_list=list(service_account.scope_list or []),
        is_active=service_account.is_active,
        all_projects=service_account.all_projects,
        project_ids=sorted(project_ids),
    )


def serialize_service_account_token(token: ServiceAccountToken) -> RpcServiceAccountToken:
    return RpcServiceAccountToken(
        id=token.id,
        service_account_id=token.service_account_id,
        organization_id=token.organization_id,
        token_hashed=token.token_hashed,
        scope_list=list(token.scope_list or []),
        date_expires=token.date_expires,
        date_deactivated=token.date_deactivated,
    )
