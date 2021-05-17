from collections import defaultdict
from typing import Any, Dict, Iterable, Mapping

from sentry.api.serializers import Serializer


class NotificationSettingsSerializer(Serializer):  # type: ignore
    """
    This Serializer fetches and serializes NotificationSettings for a list of
    targets (users or teams.) Pass filters like `project=project` and
    `type=NotificationSettingTypes.DEPLOY` to kwargs.
    """

    def get_attrs(
        self, item_list: Iterable[Any], user: Any, **kwargs: Any
    ) -> Mapping[Any, Iterable[Any]]:
        """
        This takes a list of Actors (which are either Users or Teams,
        because both can have Notification Settings). The function
        returns a mapping of targets to flat lists of object to be passed to the
        `serialize` function.

        :param item_list: List of Actor objects whose notification
            settings should be serialized.
        :param user: The user who will be viewing the notification settings.
        :param kwargs: Dict of optional filter options:
            - type: NotificationSettingTypes enum value. e.g. WORKFLOW, DEPLOY.
        """
        from sentry.models import NotificationSetting

        actor_mapping = {actor.id: actor for actor in item_list}
        filter_kwargs = dict(target_ids=actor_mapping.keys())

        type_option = kwargs.get("type")
        if type_option:
            filter_kwargs["type"] = type_option

        notifications_settings = NotificationSetting.objects._filter(**filter_kwargs)

        results = defaultdict(list)
        for notifications_setting in notifications_settings:
            target = actor_mapping.get(notifications_setting.target_id)
            results[target].append(notifications_setting)

        return results

    def serialize(
        self,
        obj: Any,
        attrs: Iterable[Any],
        user: Any,
        **kwargs: Any,
    ) -> Mapping[str, Mapping[str, Mapping[int, Mapping[str, str]]]]:
        """
        Convert a user or team's NotificationSettings to a python object comprised of primitives.
        Example: {
            "workflow": {
                "project": {
                    1: {
                        "email": "always",
                        "slack": "always"
                    },
                    2: {
                        "email": "subscribe_only",
                        "slack": "subscribe_only"
                    }
                }
            }
        }

        :param obj: A user or team.
        :param attrs: The `obj` target's NotificationSettings
        :param user: The user who will be viewing the NotificationSettings.
        :param kwargs: Currently unused but the same `kwargs` as `get_attrs`.
        :returns A mapping. See example.
        """
        data: Dict[str, Dict[str, Dict[int, Dict[str, str]]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(dict))
        )
        for n in attrs:  # Forgive the variable name, I wanted the next line to be legible.
            data[n.type_str][n.scope_str][n.scope_identifier][n.provider_str] = n.value_str

        return data
