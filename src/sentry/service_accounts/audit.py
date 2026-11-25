from __future__ import annotations

from typing import Any

from sentry.service_accounts.models import ServiceAccount, ServiceAccountToken


def token_audit_log_data(
    service_account: ServiceAccount,
    token: ServiceAccountToken,
    *,
    account_deleted: bool = False,
) -> dict[str, Any]:
    # Never the token or its hash.
    data: dict[str, Any] = {
        "name": token.name,
        "scopes": sorted(token.scope_list),
        "service_account_id": service_account.id,
        "service_account_name": service_account.name,
    }
    if account_deleted:
        data["reason"] = "service_account_deleted"
    return data
