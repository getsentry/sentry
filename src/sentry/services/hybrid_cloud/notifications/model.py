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
)
from sentry.services.hybrid_cloud import RpcModel
from sentry.types.integrations import ExternalProviders


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


class RpcExternalActor(RpcModel):
    id: int = -1
    team_id: Optional[int] = None
    user_id: Optional[int] = None
    organization_id: int = -1
    integration_id: int = -1

    provider: int = ExternalProviders.UNUSED_GH
    # The display name i.e. username, team name, channel name.
    external_name: str = ""
    # The unique identifier i.e user ID, channel ID.
    external_id: Optional[str] = None
