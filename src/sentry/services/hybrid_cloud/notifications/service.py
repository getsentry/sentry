# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from abc import abstractmethod
from typing import List, Mapping, MutableMapping, Optional, Set, Tuple

from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode
from sentry.types.integrations import ExternalProviderEnum, ExternalProviders


class NotificationsService(RpcService):
    key = "notifications"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.notifications.impl import (
            DatabaseBackedNotificationsService,
        )

        return DatabaseBackedNotificationsService()

    @rpc_method
    @abstractmethod
    def enable_all_settings_for_provider(
        self,
        *,
        external_provider: ExternalProviderEnum,
        user_id: Optional[int] = None,
        team_id: Optional[int] = None,
        types: Optional[List[NotificationSettingEnum]] = None,
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def update_notification_options(
        self,
        *,
        actor: RpcActor,
        type: NotificationSettingEnum,
        scope_type: NotificationScopeEnum,
        scope_identifier: int,
        value: NotificationSettingsOptionEnum,
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def remove_notification_settings_for_provider_team(
        self, *, team_id: int, provider: ExternalProviders
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def remove_notification_settings_for_organization(self, *, organization_id: int) -> None:
        pass

    @rpc_method
    @abstractmethod
    def remove_notification_settings_for_project(self, *, project_id: int) -> None:
        pass

    @rpc_method
    @abstractmethod
    def get_subscriptions_for_projects(
        self,
        *,
        user_id: int,
        project_ids: List[int],
        type: NotificationSettingEnum,
    ) -> Mapping[int, Tuple[bool, bool, bool]]:
        pass

    @rpc_method
    @abstractmethod
    def get_participants(
        self,
        *,
        recipients: List[RpcActor],
        type: NotificationSettingEnum,
        project_ids: Optional[List[int]] = None,
        organization_id: Optional[int] = None,
    ) -> MutableMapping[int, MutableMapping[int, str]]:
        pass

    @rpc_method
    @abstractmethod
    def get_users_for_weekly_reports(
        self, *, organization_id: int, user_ids: List[int]
    ) -> List[int]:
        pass

    @rpc_method
    @abstractmethod
    def get_notification_recipients(
        self,
        *,
        recipients: List[RpcActor],
        type: NotificationSettingEnum,
        organization_id: Optional[int] = None,
        project_ids: Optional[List[int]] = None,
        actor_type: Optional[ActorType] = None,
    ) -> Mapping[str, Set[RpcActor]]:
        pass


notifications_service = NotificationsService.create_delegation()
