from sentry.auth.services.service_account.model import RpcServiceAccount
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
