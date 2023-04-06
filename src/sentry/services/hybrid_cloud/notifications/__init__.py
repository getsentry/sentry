# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import TYPE_CHECKING, List, Optional, Sequence, cast

from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import NotificationSetting


class RpcNotificationSetting(RpcModel):
    scope_type: NotificationScopeType = NotificationScopeType.USER
    scope_identifier: int = -1
    target_id: int = -1
    provider: ExternalProviders = ExternalProviders.EMAIL
    type: NotificationSettingTypes = NotificationSettingTypes.WORKFLOW
    value: NotificationSettingOptionValues = NotificationSettingOptionValues.DEFAULT


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

    @classmethod
    def serialize_notification_setting(
        self, setting: "NotificationSetting"
    ) -> RpcNotificationSetting:
        return RpcNotificationSetting(
            scope_type=setting.scope_type,
            scope_identifier=setting.scope_identifier,
            target_id=setting.target_id,
            provider=setting.provider,
            type=setting.type,
            value=setting.value,
        )

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
    def uninstall_slack_settings(
        self,
        organization_id: int,
        project_ids: List[int],
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def remove_notification_settings(self, *, actor_id: int, provider: ExternalProviders) -> None:
        """
        Delete notification settings based on an actor_id
        There is no foreign key relationship so we have to manually cascade.
        """
        pass


notifications_service: NotificationsService = cast(
    NotificationsService, NotificationsService.create_delegation()
)
