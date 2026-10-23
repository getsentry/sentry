# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

from sentry.hybridcloud.rpc.caching import back_with_silo_cache
from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.service_accounts.services.service_account.model import RpcServiceAccount
from sentry.silo.base import SiloMode


class ServiceAccountService(RpcService):
    key = "service_account"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.service_accounts.services.service_account.impl import (
            DatabaseBackedServiceAccountService,
        )

        return DatabaseBackedServiceAccountService()

    def get(self, *, service_account_id: int) -> RpcServiceAccount | None:
        """
        Get a service account through the cell cache. Prefer this over `get_service_account`,
        which always calls control.
        """
        return get_service_account(service_account_id)

    @rpc_method
    @abstractmethod
    def get_service_account(self, *, service_account_id: int) -> RpcServiceAccount | None:
        """
        Get a service account with the projects it is restricted to.

        This doesn't check the organization or `is_active`. Callers must check both against
        the request. Use `get` instead, which reads through the cell cache.
        """


@back_with_silo_cache(
    "service_account_service.get_service_account", SiloMode.CELL, RpcServiceAccount
)
def get_service_account(service_account_id: int) -> RpcServiceAccount | None:
    """
    Cached in the cell. The `SERVICE_ACCOUNT_UPDATE` outbox receiver clears the entry
    whenever the account or its projects change, so the cache TTL is only a backstop.
    """
    return service_account_service.get_service_account(service_account_id=service_account_id)


service_account_service = ServiceAccountService.create_delegation()
