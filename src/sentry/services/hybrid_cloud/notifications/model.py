# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import List, Optional

from typing_extensions import TypedDict

from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
    get_notification_scope_name,
    get_notification_setting_type_name,
    get_notification_setting_value_name,
)
from sentry.services.hybrid_cloud import RpcModel
from sentry.types.integrations import ExternalProviders, get_provider_name


class NotificationSettingFilterArgs(TypedDict, total=False):
    provider: ExternalProviders
    type: NotificationSettingTypes
    scope_type: NotificationScopeType
    scope_identifier: int
    user_ids: List[int]
    team_ids: List[int]


class RpcNotificationSetting(RpcModel):
    scope_type: NotificationScopeType = NotificationScopeType.USER
    scope_identifier: int = -1
    id: int = -1
    target_id: Optional[int] = None
    team_id: Optional[int] = None
    user_id: Optional[int] = None
    provider: ExternalProviders = ExternalProviders.EMAIL
    type: NotificationSettingTypes = NotificationSettingTypes.WORKFLOW
    value: NotificationSettingOptionValues = NotificationSettingOptionValues.DEFAULT

    def __hash__(self) -> int:
        return hash((self.id,))

    @property
    def scope_str(self) -> str:
        return get_notification_scope_name(self.scope_type.value)

    @property
    def type_str(self) -> str:
        return get_notification_setting_type_name(self.type)

    @property
    def value_str(self) -> str:
        return get_notification_setting_value_name(self.value.value)

    @property
    def provider_str(self) -> str:
        return get_provider_name(self.provider.value)
