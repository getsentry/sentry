# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import List, Mapping, Optional, Sequence, cast

from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.notifications import RpcNotificationSetting
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode
from sentry.types.integrations import ExternalProviders


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
    def get_settings_for_recipient_by_parent(
        self,
        *,
        type: NotificationSettingTypes,
        parent_id: int,
        recipients: Sequence[RpcActor],
    ) -> List[RpcNotificationSetting]:
        pass

    @rpc_method
    @abstractmethod
    def get_settings_for_users(
        self,
        *,
        types: List[NotificationSettingTypes],
        users: List[RpcUser],
        value: NotificationSettingOptionValues,
    ) -> List[RpcNotificationSetting]:
        pass

    @rpc_method
    @abstractmethod
    def get_settings_for_user_by_projects(
        self, *, type: NotificationSettingTypes, user_id: int, parent_ids: List[int]
    ) -> List[RpcNotificationSetting]:
        pass

    @rpc_method
    @abstractmethod
    def update_settings(
        self,
        *,
        external_provider: ExternalProviders,
        notification_type: NotificationSettingTypes,
        setting_option: NotificationSettingOptionValues,
        actor: RpcActor,
        project_id: Optional[int] = None,
        organization_id: Optional[int] = None,
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def bulk_update_settings(
        self,
        *,
        notification_type_to_value_map: Mapping[
            NotificationSettingTypes, NotificationSettingOptionValues
        ],
        external_provider: ExternalProviders,
        actor: RpcActor,
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def uninstall_slack_settings(
        self,
        organization_id: int,
        project_ids: List[int],
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def remove_notification_settings_for_team(
        self, *, team_id: int, provider: ExternalProviders
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def remove_notification_settings_for_user(
        self, *, user_id: int, provider: ExternalProviders
    ) -> None:
        pass


notifications_service: NotificationsService = cast(
    NotificationsService, NotificationsService.create_delegation()
)
