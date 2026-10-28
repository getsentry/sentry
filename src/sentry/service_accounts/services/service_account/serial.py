from __future__ import annotations

from collections.abc import Iterable

from sentry.service_accounts.models import ServiceAccount
from sentry.service_accounts.services.service_account.model import RpcServiceAccount


def serialize_service_account(
    service_account: ServiceAccount, project_ids: Iterable[int]
) -> RpcServiceAccount:
    return RpcServiceAccount(
        id=service_account.id,
        organization_id=service_account.organization_id,
        name=service_account.name,
        scope_list=list(service_account.scope_list or []),
        is_active=service_account.is_active,
        project_ids=sorted(project_ids),
    )
