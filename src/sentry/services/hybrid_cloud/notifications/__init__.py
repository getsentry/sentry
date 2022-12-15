from __future__ import annotations

import dataclasses
from abc import abstractmethod
from typing import TYPE_CHECKING, List, Protocol

from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import NotificationSetting


@dataclasses.dataclass
class ApiNotificationSetting:
    scope_type: NotificationScopeType = NotificationScopeType.USER
    scope_identifier: int = -1
    target_id: int = -1
    provider: ExternalProviders = ExternalProviders.EMAIL
    type: NotificationSettingTypes = NotificationSettingTypes.WORKFLOW
    value: NotificationSettingOptionValues = NotificationSettingOptionValues.DEFAULT


class MayHaveActor(Protocol):
    id: int
    actor_id: int | None

    def class_name(self) -> str:
        pass


class NotificationsService(InterfaceWithLifecycle):
    @abstractmethod
    def get_settings_for_recipient_by_parent(
        self,
        *,
        type: NotificationSettingTypes,
        parent_id: int,
        recipients: List[MayHaveActor],
    ) -> List[ApiNotificationSetting]:
        pass

    @abstractmethod
    def get_settings_for_user_by_projects(
        self, *, type: NotificationSettingTypes, user_id: int, parent_ids: List[int]
    ) -> List[ApiNotificationSetting]:
        pass

    def _serialize_notification_settings(
        self, setting: NotificationSetting
    ) -> ApiNotificationSetting:
        return ApiNotificationSetting(
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
