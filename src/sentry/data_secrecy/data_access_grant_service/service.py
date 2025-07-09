# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc

from sentry.data_secrecy.data_access_grant_service.model import RpcEffectiveWaiverStatus
from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.silo.base import SiloMode


class DataAccessGrantService(RpcService):
    key = "data_access_grant"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.data_secrecy.data_access_grant_service.impl import (
            DatabaseBackedDataAccessGrantService,
        )

        return DatabaseBackedDataAccessGrantService()

    @rpc_method
    @abc.abstractmethod
    def get_effective_waiver_status(
        self, *, organization_id: int
    ) -> RpcEffectiveWaiverStatus | None:
        pass


data_access_grant_service = DataAccessGrantService.create_delegation()
