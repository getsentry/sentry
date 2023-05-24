# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Optional

from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud import RpcModel
from sentry.types.integrations import ExternalProviders


class RpcNotificationSetting(RpcModel):
    scope_type: NotificationScopeType = NotificationScopeType.USER
    scope_identifier: int = -1
    target_id: int = -1
    team_id: Optional[int] = None
    user_id: Optional[int] = None
    provider: ExternalProviders = ExternalProviders.EMAIL
    type: NotificationSettingTypes = NotificationSettingTypes.WORKFLOW
    value: NotificationSettingOptionValues = NotificationSettingOptionValues.DEFAULT
