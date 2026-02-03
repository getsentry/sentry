# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc

from sentry.hybridcloud.rpc.resolvers import ByOrganizationId, ByRegionName
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.silo.base import SiloMode


class ActionService(RpcService):
    key = "workflow_engine_action"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.workflow_engine.service.action.impl import DatabaseBackedActionService

        return DatabaseBackedActionService()

    @regional_rpc_method(resolve=ByOrganizationId())
    @abc.abstractmethod
    def delete_actions_for_organization_integration(
        self, *, organization_id: int, integration_id: int
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abc.abstractmethod
    def update_action_status_for_organization_integration(
        self, *, organization_id: int, integration_id: int, status: int
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abc.abstractmethod
    def update_action_status_for_sentry_app_via_uuid(
        self,
        *,
        organization_id: int,
        status: int,
        sentry_app_install_uuid: str,
        sentry_app_id: int = 0,
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def update_action_status_for_sentry_app_via_uuid__region(
        self,
        *,
        region_name: str,
        status: int,
        sentry_app_install_uuid: str,
        sentry_app_id: int = 0,
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def update_action_status_for_sentry_app_via_sentry_app_id(
        self,
        *,
        region_name: str,
        status: int,
        sentry_app_id: int,
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def update_action_status_for_webhook_via_sentry_app_slug(
        self,
        *,
        region_name: str,
        status: int,
        sentry_app_slug: str,
    ) -> None:
        pass


action_service = ActionService.create_delegation()
