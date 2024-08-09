# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc

from sentry.data_secrecy.service.model import RpcDataSecrecyWaiver
from sentry.hybridcloud.rpc.resolvers import ByOrganizationId
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.silo.base import SiloMode


class DataSecrecyService(RpcService):
    key = "data_secrecy"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.data_secrecy.service.impl import DatabaseBackedDataSecrecyService

        return DatabaseBackedDataSecrecyService()

    @regional_rpc_method(resolve=ByOrganizationId())
    @abc.abstractmethod
    def get_data_secrecy_waiver(self, *, organization_id: int) -> RpcDataSecrecyWaiver | None:
        pass


data_secrecy_service = DataSecrecyService.create_delegation()
