# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from typing import Any, List, Mapping, Optional, cast

from sentry.services.hybrid_cloud.app import (
    RpcAlertRuleActionResult,
    RpcSentryApp,
    RpcSentryAppComponent,
    RpcSentryAppEventData,
    RpcSentryAppInstallation,
    RpcSentryAppService,
    SentryAppInstallationFilterArgs,
)
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import OpaqueSerializedResponse
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode


class AppService(RpcService):
    key = "app"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.app.impl import DatabaseBackedAppService

        return DatabaseBackedAppService()

    @rpc_method
    @abc.abstractmethod
    def serialize_many(
        self,
        *,
        filter: SentryAppInstallationFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
    ) -> List[OpaqueSerializedResponse]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_many(
        self, *, filter: SentryAppInstallationFilterArgs
    ) -> List[RpcSentryAppInstallation]:
        pass

    @rpc_method
    @abc.abstractmethod
    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> Optional[RpcSentryAppInstallation]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_installed_for_organization(
        self,
        *,
        organization_id: int,
    ) -> List[RpcSentryAppInstallation]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_sentry_app_by_slug(self, *, slug: str) -> Optional[RpcSentryApp]:
        pass

    @rpc_method
    @abc.abstractmethod
    def find_alertable_services(self, *, organization_id: int) -> List[RpcSentryAppService]:
        pass

    @rpc_method
    @abc.abstractmethod
    def find_service_hook_sentry_app(self, *, api_application_id: int) -> Optional[RpcSentryApp]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_custom_alert_rule_actions(
        self,
        *,
        event_data: RpcSentryAppEventData,
        organization_id: int,
        project_slug: Optional[str],
    ) -> List[Mapping[str, Any]]:
        pass

    @rpc_method
    @abc.abstractmethod
    def find_app_components(self, *, app_id: int) -> List[RpcSentryAppComponent]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_related_sentry_app_components(
        self,
        *,
        organization_ids: List[int],
        sentry_app_ids: List[int],
        type: str,
        group_by: str = "sentry_app_id",
    ) -> Mapping[str, Any]:
        pass

    @rpc_method
    @abc.abstractmethod
    def trigger_sentry_app_action_creators(
        self, *, fields: List[Mapping[str, Any]], install_uuid: Optional[str]
    ) -> RpcAlertRuleActionResult:
        pass


app_service = cast(AppService, AppService.create_delegation())
