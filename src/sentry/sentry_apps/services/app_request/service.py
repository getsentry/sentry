import abc

from sentry.hybridcloud.rpc.resolvers import ByCellName
from sentry.hybridcloud.rpc.service import RpcService, cell_rpc_method
from sentry.sentry_apps.services.app_request.model import (
    RpcSentryAppRequest,
    SentryAppRequestFilterArgs,
)
from sentry.silo.base import SiloMode


class SentryAppRequestService(RpcService):
    key = "sentry_app_request"
    local_mode = SiloMode.CELL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.sentry_apps.services.app_request.impl import (
            DatabaseBackedSentryAppRequestService,
        )

        return DatabaseBackedSentryAppRequestService()

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def get_buffer_requests_for_cell(
        self,
        *,
        sentry_app_id: str,
        cell_name: str,
        filter: SentryAppRequestFilterArgs | None = None,
    ) -> list[RpcSentryAppRequest] | None:
        pass


app_request_service = SentryAppRequestService.create_delegation()
