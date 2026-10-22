# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

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

    @rpc_method
    @abstractmethod
    def get_service_account(self, *, service_account_id: int) -> RpcServiceAccount | None:
        """
        Deprecated: cells read `ServiceAccountReplica` instead. Kept until the RPC method is
        disabled and removed through the RPC deprecation process.
        """


service_account_service = ServiceAccountService.create_delegation()
