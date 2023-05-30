from collections import defaultdict
from typing import Any, Iterable, Mapping, MutableMapping, Optional, Set, Union

from sentry.api.serializers import Serializer
from sentry.models.notificationsetting import NotificationSetting
from sentry.models.team import Team
from sentry.models.user import User
from sentry.notifications.helpers import get_fallback_settings
from sentry.notifications.types import VALID_VALUES_FOR_KEY, NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.organization import RpcTeam
from sentry.services.hybrid_cloud.user import RpcUser


class NotificationSettingsSerializer(Serializer):  # type: ignore
    """
    This Serializer fetches and serializes NotificationSettings for a list of
    targets (users or teams.) Pass filters like `project=project` and
    `type=NotificationSettingTypes.DEPLOY` to kwargs.
    """

    def get_attrs(
        self,
        item_list: Iterable[Union["Team", "User"]],
        user: User,
        **kwargs: Any,
    ) -> Mapping[Union["Team", "User"], Mapping[str, Iterable[Any]]]:
        """
        This takes a list of recipients (which are either Users or Teams,
        because both can have Notification Settings). The function
        returns a mapping of targets to flat lists of object to be passed to the
        `serialize` function.

        :param item_list: Either a Set of User or Team objects whose
            notification settings should be serialized.
        :param user: The user who will be viewing the notification settings.
        :param kwargs: Dict of optional filter options:
            - type: NotificationSettingTypes enum value. e.g. WORKFLOW, DEPLOY.
        """
        type_option: Optional[NotificationSettingTypes] = kwargs.get("type")

        team_map = {t.id: t for t in item_list if isinstance(t, (Team, RpcTeam))}
        user_map = {u.id: u for u in item_list if isinstance(u, (User, RpcUser))}

        notifications_settings = NotificationSetting.objects._filter(
            type=type_option,
            team_ids=list(team_map.keys()),
            user_ids=list(user_map.keys()),
        )

        results: MutableMapping[Union["Team", "User"], MutableMapping[str, Set[Any]]] = defaultdict(
            lambda: defaultdict(set)
        )

        for notifications_setting in notifications_settings:
            target = None
            if notifications_setting.user_id:
                target = user_map[notifications_setting.user_id]
            if notifications_setting.team_id:
                target = team_map[notifications_setting.team_id]
            if target:
                results[target]["settings"].add(notifications_setting)
            else:
                raise ValueError(
                    f"NotificationSetting {notifications_setting.id} has neither team_id nor user_id"
                )

        for recipient in item_list:
            # This works because both User and Team models implement `get_projects`.
            results[recipient]["projects"] = recipient.get_projects()

            if isinstance(recipient, Team):
                results[recipient]["organizations"] = {recipient.organization}

            if isinstance(recipient, User):
                results[recipient]["organizations"] = user.get_orgs()

        return results

    def serialize(
        self,
        obj: Union["Team", "User"],
        attrs: Mapping[str, Iterable[Any]],
        user: User,
        **kwargs: Any,
    ) -> Mapping[str, Mapping[str, Mapping[int, Mapping[str, str]]]]:
        """
        Convert a user or team's NotificationSettings to a python object
        comprised of primitives. This will backfill all possible notification
        settings with the appropriate defaults.

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
        :param kwargs: The same `kwargs` as `get_attrs`.
        :returns A mapping. See example.
        """
        type_option: Optional[NotificationSettingTypes] = kwargs.get("type")
        types_to_serialize = {type_option} if type_option else set(VALID_VALUES_FOR_KEY.keys())

        project_ids = {_.id for _ in attrs["projects"]}
        organization_ids = {_.id for _ in attrs["organizations"]}

        data = get_fallback_settings(
            types_to_serialize,
            project_ids,
            organization_ids,
            recipient=RpcActor.from_object(obj),
        )

        # Forgive the variable name, I wanted the following lines to be legible.
        for n in attrs["settings"]:
            # Filter out invalid notification settings.
            if (n.scope_str == "project" and n.scope_identifier not in project_ids) or (
                n.scope_str == "organization" and n.scope_identifier not in organization_ids
            ):
                continue

            # Override the notification settings.
            data[n.type_str][n.scope_str][n.scope_identifier][n.provider_str] = n.value_str
        return data
