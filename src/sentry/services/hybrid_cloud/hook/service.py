# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from typing import List, Optional

from sentry.services.hybrid_cloud.hook import RpcServiceHook
from sentry.services.hybrid_cloud.region import ByOrganizationId
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.silo import SiloMode


class HookService(RpcService):
    key = "hook"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.hook.impl import DatabaseBackedHookService

        return DatabaseBackedHookService()

    @regional_rpc_method(ByOrganizationId())
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

    @regional_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def update_webhook_and_events(
        self,
        *,
        organization_id: int,
        application_id: Optional[int],
        webhook_url: Optional[str],
        events: List[str],
    ) -> List[RpcServiceHook]:
        pass


hook_service = HookService.create_delegation()
