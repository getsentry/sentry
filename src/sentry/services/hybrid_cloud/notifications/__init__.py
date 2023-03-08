# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import List, Optional, Sequence, Union, cast

from sentry.models import NotificationSetting, Team
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode
from sentry.types.integrations import ExternalProviders


class RpcNotificationSetting(RpcModel):
    scope_type: NotificationScopeType = NotificationScopeType.USER
    scope_identifier: int = -1
    target_id: int = -1
    provider: ExternalProviders = ExternalProviders.EMAIL
    type: NotificationSettingTypes = NotificationSettingTypes.WORKFLOW
    value: NotificationSettingOptionValues = NotificationSettingOptionValues.DEFAULT


class RpcRecipient(RpcModel):
    id: int
    actor_id: Optional[int]
    source_class: str

    @classmethod
    def of(cls, obj: Union[RpcUser, Team]) -> "RpcRecipient":
        if isinstance(obj, RpcUser):
            return cls(id=obj.id, actor_id=obj.actor_id, source_class="User")
        if isinstance(obj, Team):
            return cls(id=obj.id, actor_id=obj.actor_id, source_class="Team")
        raise TypeError


class NotificationsService(RpcService):
    name = "notifications"
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
        recipients: Sequence[RpcRecipient],
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

    def _serialize_notification_settings(
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


notifications_service: NotificationsService = cast(
    NotificationsService, NotificationsService.resolve_to_delegation()
)
