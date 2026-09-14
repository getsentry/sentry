# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from datetime import datetime

from sentry.auth.services.service_account.model import (
    RpcServiceAccount,
    RpcServiceAccountCreation,
)
from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.silo.base import SiloMode


class ServiceAccountService(RpcService):
    key = "service_account"
    local_mode = SiloMode.CONTROL

    @rpc_method
    @abc.abstractmethod
    def create(
        self,
        *,
        organization_id: int,
        name: str,
        scopes: list[str],
        expires_at: datetime | None,
    ) -> RpcServiceAccountCreation | None:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_for_token(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        token_id: int,
    ) -> RpcServiceAccount | None:
        pass

    @rpc_method
    @abc.abstractmethod
    def delete(self, *, organization_id: int, service_account_id: int) -> bool:
        pass

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import DatabaseBackedServiceAccountService

        return DatabaseBackedServiceAccountService()


service_account_service = ServiceAccountService.create_delegation()
