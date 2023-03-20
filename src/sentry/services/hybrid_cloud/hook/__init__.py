# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
import dataclasses
from typing import Any, List, Mapping, Optional

from sentry.models import ServiceHook
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode


@dataclasses.dataclass
class RpcServiceHook:
    id: int = -1
    guid: str = ""
    application_id: int = -1
    installation_id: Optional[int] = None
    project_id: Optional[int] = None
    organization_id: Optional[int] = None
    url: str = ""
    events: List[str] = dataclasses.field(default_factory=list)
    status: int = 0

    def get_audit_log_data(self) -> Mapping[str, Any]:
        return {"url": self.url}


class HookService(InterfaceWithLifecycle):
    def serialize_service_hook(self, hook: ServiceHook) -> RpcServiceHook:
        return RpcServiceHook(
            id=hook.id,
            guid=hook.guid,
            application_id=hook.application_id,
            installation_id=hook.installation_id,
            project_id=hook.project_id,
            organization_id=hook.organization_id,
            url=hook.url,
            events=hook.events,
            status=hook.status,
        )

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
