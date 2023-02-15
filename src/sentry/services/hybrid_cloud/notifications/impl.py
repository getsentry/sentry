from __future__ import annotations

from typing import List, Sequence

from django.db.models import Q

from sentry.models import NotificationSetting, User
from sentry.notifications.helpers import get_scope_type
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.notifications import (
    MayHaveActor,
    NotificationsService,
    RpcNotificationSetting,
)
from sentry.services.hybrid_cloud.user import RpcUser


class DatabaseBackedNotificationsService(NotificationsService):
    def get_settings_for_users(
        self,
        *,
        types: List[NotificationSettingTypes],
        users: List[RpcUser],
        value: NotificationSettingOptionValues,
    ) -> List[RpcNotificationSetting]:
        settings = NotificationSetting.objects.filter(
            target__in=[u.actor_id for u in users],
            type__in=types,
            value=value.value,
            scope_type=NotificationScopeType.USER.value,
        )
        return [self._serialize_notification_settings(u) for u in settings]

    def get_settings_for_recipient_by_parent(
        self, *, type: NotificationSettingTypes, parent_id: int, recipients: Sequence[MayHaveActor]
    ) -> List[RpcNotificationSetting]:
        team_ids = [r.id for r in recipients if r.class_name() == "Team"]
        user_ids = [r.id for r in recipients if r.class_name() == "User"]
        actor_ids: List[int] = [r.actor_id for r in recipients if r.actor_id is not None]

        parent_specific_scope_type = get_scope_type(type)
        notification_settings = NotificationSetting.objects.filter(
            Q(
                scope_type=parent_specific_scope_type.value,
                scope_identifier=parent_id,
            )
            | Q(
                scope_type=NotificationScopeType.USER.value,
                scope_identifier__in=user_ids,
            )
            | Q(
                scope_type=NotificationScopeType.TEAM.value,
                scope_identifier__in=team_ids,
            ),
            type=type.value,
            target__in=actor_ids,
        )

        return [self._serialize_notification_settings(s) for s in notification_settings]

    def get_settings_for_user_by_projects(
        self, *, type: NotificationSettingTypes, user_id: int, parent_ids: List[int]
    ) -> List[RpcNotificationSetting]:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return []

        scope_type = get_scope_type(type)
        return [
            self._serialize_notification_settings(s)
            for s in NotificationSetting.objects.filter(
                Q(
                    scope_type=scope_type.value,
                    scope_identifier__in=parent_ids,
                )
                | Q(
                    scope_type=NotificationScopeType.USER.value,
                    scope_identifier=user_id,
                ),
                type=type.value,
                target_id=user.actor_id,
            )
        ]

    def close(self) -> None:
        pass
