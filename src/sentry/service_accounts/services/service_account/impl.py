from __future__ import annotations

from sentry.service_accounts.models import ServiceAccount, ServiceAccountProject
from sentry.service_accounts.services.service_account.model import RpcServiceAccount
from sentry.service_accounts.services.service_account.serial import serialize_service_account
from sentry.service_accounts.services.service_account.service import ServiceAccountService


class DatabaseBackedServiceAccountService(ServiceAccountService):
    def get_service_account(self, *, service_account_id: int) -> RpcServiceAccount | None:
        service_account = ServiceAccount.objects.filter(id=service_account_id).first()
        if service_account is None:
            return None
        project_ids = ServiceAccountProject.objects.filter(
            service_account_id=service_account.id
        ).values_list("project_id", flat=True)
        return serialize_service_account(service_account, project_ids)
