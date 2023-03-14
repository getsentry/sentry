# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

import dataclasses
from abc import abstractmethod
from typing import TYPE_CHECKING, List, Sequence

from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import NotificationSetting


@dataclasses.dataclass
class RpcNotificationSetting:
    scope_type: NotificationScopeType = NotificationScopeType.USER
    scope_identifier: int = -1
    target_id: int = -1
    provider: ExternalProviders = ExternalProviders.EMAIL
    type: NotificationSettingTypes = NotificationSettingTypes.WORKFLOW
    value: NotificationSettingOptionValues = NotificationSettingOptionValues.DEFAULT


class NotificationsService(InterfaceWithLifecycle):
    @abstractmethod
    def get_settings_for_recipient_by_parent(
        self,
        *,
        type: NotificationSettingTypes,
        parent_id: int,
        recipients: Sequence[RpcActor],
    ) -> List[RpcNotificationSetting]:
        pass

    @abstractmethod
    def get_settings_for_users(
        self,
        *,
        types: List[NotificationSettingTypes],
        users: List[RpcUser],
        value: NotificationSettingOptionValues,
    ) -> List[RpcNotificationSetting]:
        pass

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


def impl_with_db() -> NotificationsService:
    from sentry.services.hybrid_cloud.notifications.impl import DatabaseBackedNotificationsService

    return DatabaseBackedNotificationsService()


notifications_service: NotificationsService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_with_db,
    }
)
