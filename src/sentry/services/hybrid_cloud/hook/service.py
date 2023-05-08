# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from typing import List, Optional

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.hook import RpcServiceHook
from sentry.silo import SiloMode


class HookService(InterfaceWithLifecycle):
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

    @abc.abstractmethod
    def update_webhook_and_events(
        self,
        *,
        application_id: Optional[int] = None,
        webhook_url: Optional[str] = None,
        events: List[str],
    ) -> List[RpcServiceHook]:
        pass


def impl_with_db() -> HookService:
    from sentry.services.hybrid_cloud.hook.impl import DatabaseBackedAppService

    return DatabaseBackedAppService()


hook_service: HookService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: impl_with_db,
        SiloMode.CONTROL: stubbed(impl_with_db, SiloMode.REGION),
    }
)
