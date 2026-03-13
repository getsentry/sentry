# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc

from sentry.hybridcloud.rpc.resolvers import ByCellName, ByOrganizationId
from sentry.hybridcloud.rpc.service import RpcService, cell_rpc_method
from sentry.sentry_apps.services.hook import RpcServiceHook
from sentry.sentry_apps.services.hook.model import RpcInstallationOrganizationPair
from sentry.silo.base import SiloMode


class HookService(RpcService):
    key = "hook"
    local_mode = SiloMode.CELL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.sentry_apps.services.hook.impl import DatabaseBackedHookService

        return DatabaseBackedHookService()

    @cell_rpc_method(ByOrganizationId())
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

    @cell_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def update_webhook_and_events(
        self,
        *,
        organization_id: int,
        application_id: int | None,
        webhook_url: str | None,
        events: list[str],
    ) -> list[RpcServiceHook]:
        """
        Update ALL webhooks for a given sentry app (region determined by organization_id).
        """
        pass

    @cell_rpc_method(ByCellName())
    @abc.abstractmethod
    def update_webhook_and_events_for_app_by_region(
        self,
        *,
        application_id: int | None,
        webhook_url: str | None,
        events: list[str],
        region_name: str,
    ) -> list[RpcServiceHook]:
        """
        Update ALL webhooks in a given region for a sentry app.
        """
        pass

    @cell_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def create_or_update_webhook_and_events_for_installation(
        self,
        *,
        installation_id: int,
        organization_id: int,
        webhook_url: str | None,
        events: list[str],
        application_id: int,
    ) -> list[RpcServiceHook]:
        """
        Update the webhook and events for a given sentry app installation.
        """
        pass

    @cell_rpc_method(ByCellName())
    @abc.abstractmethod
    def bulk_create_service_hooks_for_app(
        self,
        *,
        region_name: str,
        application_id: int,
        events: list[str],
        installation_organization_ids: list[RpcInstallationOrganizationPair],
        url: str,
    ) -> list[RpcServiceHook]:
        """Meant for bulk creating ServiceHooks for all installations of a given Sentry App in a given region"""
        pass


hook_service = HookService.create_delegation()
