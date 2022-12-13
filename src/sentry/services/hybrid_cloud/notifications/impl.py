from typing import List

from django.db.models import Q

from sentry.models import NotificationSetting, User
from sentry.notifications.helpers import get_scope_type
from sentry.notifications.types import NotificationScopeType, NotificationSettingTypes
from sentry.services.hybrid_cloud.notifications import ApiNotificationSetting, NotificationsService


class DatabaseBackedNotificationsService(NotificationsService):
    def get_settings_for_user_by_projects(
        self, *, type: NotificationSettingTypes, user_id: int, parent_ids: List[int]
    ) -> List[ApiNotificationSetting]:
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
