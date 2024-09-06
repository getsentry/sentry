# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc

from sentry.hybridcloud.rpc.resolvers import ByOrganizationId
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.sentry_apps.services.hook import RpcServiceHook
from sentry.silo.base import SiloMode


class HookService(RpcService):
    key = "hook"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.sentry_apps.services.hook.impl import DatabaseBackedHookService

        return DatabaseBackedHookService()

    @regional_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def create_service_hook(
        self,
        *,
        application_id: int | None = None,
        actor_id: int = -1,
        installation_id: int | None = None,
        organization_id: int = -1,
        project_ids: list[int] | None = None,
        events: list[str] | None = None,
        url: str = "",
    ) -> RpcServiceHook:
        pass

    @regional_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def update_webhook_and_events(
        self,
        *,
        organization_id: int,
        application_id: int | None,
        webhook_url: str | None,
        events: list[str],
    ) -> list[RpcServiceHook]:
        pass


hook_service = HookService.create_delegation()
