import abc

from sentry.hybridcloud.rpc.resolvers import ByRegionName
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.sentry_apps.services.app_request.model import (
    RpcSentryAppRequest,
    SentryAppRequestFilterArgs,
)
from sentry.silo.base import SiloMode


class SentryAppRequestService(RpcService):
    key = "sentry_app_request"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.sentry_apps.services.app_request.impl import (
            DatabaseBackedSentryAppRequestService,
        )

        return DatabaseBackedSentryAppRequestService()

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def get_buffer_requests_for_region(
        self,
        *,
        sentry_app_id: str,
        region_name: str,
        filter: SentryAppRequestFilterArgs | None = None,
    ) -> list[RpcSentryAppRequest] | None:
        pass


app_request_service = SentryAppRequestService.create_delegation()
