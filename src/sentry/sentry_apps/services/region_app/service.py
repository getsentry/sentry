import abc

from sentry.hybridcloud.rpc.resolvers import ByRegionName
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.sentry_apps.services.app import RpcSentryApp
from sentry.sentry_apps.services.region_app.model import (
    RpcSentryAppRequest,
    SentryAppRequestFilterArgs,
)
from sentry.silo.base import SiloMode


class RegionAppService(RpcService):
    key = "region_app"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.sentry_apps.services.region_app.impl import DatabaseBackedRegionAppService

        return DatabaseBackedRegionAppService()

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def get_buffer_requests_for_region(
        self,
        *,
        sentry_app: RpcSentryApp,
        region_name: str,
        filter: SentryAppRequestFilterArgs | None = None,
    ) -> list[RpcSentryAppRequest]:
        pass


region_app_service = RegionAppService.create_delegation()
