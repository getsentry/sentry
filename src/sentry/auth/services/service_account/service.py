# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from datetime import datetime

from sentry.auth.services.service_account.model import (
    RpcServiceAccount,
    RpcServiceAccountCreation,
    RpcServiceAccountDetail,
    RpcServiceAccountTokenCreation,
)
from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.silo.base import SiloMode


class ServiceAccountService(RpcService):
    key = "service_account"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.auth.services.service_account.impl import DatabaseBackedServiceAccountService

        return DatabaseBackedServiceAccountService()

    @rpc_method
    @abstractmethod
    def create(
        self,
        *,
        organization_id: int,
        name: str,
        token_name: str,
        scopes: list[str],
        expires_at: datetime | None,
    ) -> RpcServiceAccountCreation | None:
        pass

    @rpc_method
    @abstractmethod
    def get(
        self, *, organization_id: int, service_account_id: int
    ) -> RpcServiceAccountDetail | None:
        pass

    @rpc_method
    @abstractmethod
    def get_for_token(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        token_id: int,
    ) -> RpcServiceAccount | None:
        pass

    @rpc_method
    @abstractmethod
    def list_accounts(self, *, organization_id: int) -> list[RpcServiceAccountDetail]:
        pass

    @rpc_method
    @abstractmethod
    def update(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        name: str | None,
        is_active: bool | None,
    ) -> RpcServiceAccount | None:
        pass

    @rpc_method
    @abstractmethod
    def delete(self, *, organization_id: int, service_account_id: int) -> bool:
        pass

    @rpc_method
    @abstractmethod
    def create_token(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        name: str,
        scopes: list[str],
        expires_at: datetime | None,
    ) -> RpcServiceAccountTokenCreation | None:
        pass

    @rpc_method
    @abstractmethod
    def delete_token(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        token_id: int,
    ) -> bool:
        pass


service_account_service = ServiceAccountService.create_delegation()
