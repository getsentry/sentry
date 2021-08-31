from collections import defaultdict
from typing import Iterable

from sentry.api.serializers import Serializer
from sentry.models import NotificationSetting, UserOption
from sentry.notifications.types import FineTuningAPIKey, NotificationScopeType
from sentry.notifications.utils.legacy_mappings import (
    get_type_from_fine_tuning_key,
    map_notification_settings_to_legacy,
)
from sentry.types.integrations import ExternalProviders


def handle_legacy(notification_type: FineTuningAPIKey, users: Iterable) -> Iterable:
    """For EMAIL and REPORTS, check UserOptions."""
    filter_args = {}
    if notification_type == FineTuningAPIKey.EMAIL:
        filter_args["project__isnull"] = False

    key = {
        FineTuningAPIKey.EMAIL: "mail:email",
    }.get(notification_type)

    return UserOption.objects.filter(key=key, user__in=users, **filter_args).select_related(
        "user", "project", "organization"
    )


class UserNotificationsSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        notification_type = kwargs["notification_type"]
        if not get_type_from_fine_tuning_key(notification_type):
            data = handle_legacy(notification_type, item_list)
        else:
            actor_mapping = {user.actor_id: user for user in item_list}
            notifications_settings = NotificationSetting.objects._filter(
                ExternalProviders.EMAIL,
                get_type_from_fine_tuning_key(notification_type),
                target_ids=actor_mapping.keys(),
            ).exclude(scope_type=NotificationScopeType.USER.value)
            data = map_notification_settings_to_legacy(notifications_settings, actor_mapping)

        results = defaultdict(list)
        for uo in data:
            results[uo.user].append(uo)

        return results

    def serialize(self, obj, attrs, user, **kwargs):
        return {(uo.project.id if uo.project else uo.organization): str(uo.value) for uo in attrs}
