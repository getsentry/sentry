# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from typing import List, Optional, cast

from sentry.services.hybrid_cloud.hook import RpcServiceHook
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


class HookService(RpcService):
    key = "hook"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.hook.impl import DatabaseBackedHookService

        return DatabaseBackedHookService()

    @rpc_method
    @abc.abstractmethod
    def create_service_hook(
        self,
        *,
        application_id: Optional[int] = None,
        actor_id: int = -1,
        installation_id: Optional[int] = None,
        organization_id: int = -1,
        project_ids: Optional[List[int]] = None,
        events: Optional[List[str]] = None,
        url: str = "",
    ) -> RpcServiceHook:
        pass

    @rpc_method
    @abc.abstractmethod
    def update_webhook_and_events(
        self,
        *,
        application_id: Optional[int] = None,
        webhook_url: Optional[str] = None,
        events: List[str],
    ) -> List[RpcServiceHook]:
        pass


hook_service: HookService = cast(HookService, HookService.create_delegation())
