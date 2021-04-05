from collections import defaultdict
from typing import Any, Dict, Iterable, Mapping, Optional, Set, Tuple

from sentry.api.exceptions import ParameterValidationError
from sentry.api.serializers import Serializer
from sentry.api.validators.notifications import (
    validate_organizations,
    validate_projects,
    validate_provider,
    validate_scope,
    validate_scope_type,
    validate_type,
    validate_value,
)
from sentry.models.integration import ExternalProviders
from sentry.models.notificationsetting import NotificationSetting
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)


class NotificationSettingsSerializer(Serializer):  # type: ignore
    """
    This Serializer fetches and serializes NotificationSettings for a list of
    targets (users or teams.) Pass filters like `project=project` and
    `type=NotificationSettingTypes.DEPLOY` to kwargs.
    """

    def get_attrs(
        self, item_list: Iterable[Any], user: Any, **kwargs: Any
    ) -> Mapping[Any, Iterable[NotificationSetting]]:
        """
        This takes a list of either Users or Teams (which we will refer to as
        "targets") because both can have Notification Settings. The function
        returns a mapping of targets to flat lists of object to be passed to the
        `serialize` function. TODO explain why this returns a flat list.

        TODO Should this take strings instead of enums?
        :param item_list: List of user or team objects whose notification
            settings should be serialized.
        :param user: The user who will be viewing the notification settings.
        :param kwargs: Dict of optional filter options:
            - type: NotificationSettingTypes enum value. e.g. WORKFLOW, DEPLOY.
            - provider: ExternalProvider enum value. e.g. SLACK, EMAIL.
        """
        actor_mapping = {target.actor_id: target for target in item_list}
        filter_kwargs = dict(target_ids=actor_mapping.keys())

        type_option = kwargs.get("type")
        if type_option:
            filter_kwargs["type"] = type_option

        provider_option = kwargs.get("provider")
        if provider_option:
            filter_kwargs["provider"] = provider_option

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

        :param obj: A user or team.
        :param attrs: The `obj` target's NotificationSettings
        :param user: The user who will be viewing the NotificationSettings.
        :param kwargs: Currently unused but the same `kwargs` as `get_attrs`.
        :returns A mapping
        """
        data: Dict[str, Dict[str, Dict[int, Dict[str, str]]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(dict))
        )
        for n in attrs:  # Forgive the variable name, I wanted the next line to be legible.
            data[n.type_str][n.scope_str][n.scope_identifier][n.provider_str] = n.value_str

        return data

    @staticmethod
    def validate(
        data: Mapping[str, Mapping[str, Mapping[int, Mapping[str, str]]]],
        user: Optional[Any] = None,
        team: Optional[Any] = None,
    ) -> Iterable[
        Tuple[
            ExternalProviders,
            NotificationSettingTypes,
            NotificationScopeType,
            int,
            NotificationSettingOptionValues,
        ],
    ]:
        """
        Validate some serialized notification settings. If invalid, raise an
        exception. Otherwise, return them as a list of tuples.
        """
        if not data or len(data) < 1:
            raise ParameterValidationError("Payload required")

        notification_settings_to_update: Dict[
            Tuple[
                NotificationSettingTypes,
                NotificationScopeType,
                int,
                ExternalProviders,
            ],
            NotificationSettingOptionValues,
        ] = {}
        project_ids_to_look_up: Set[int] = set()
        organization_ids_to_look_up: Set[int] = set()
        for type_key, notifications_by_type in data.items():
            type = validate_type(type_key)

            for scope_type_key, notifications_by_scope_type in notifications_by_type.items():
                scope_type = validate_scope_type(scope_type_key)

                for scope_id, notifications_by_scope_id in notifications_by_scope_type.items():
                    scope_id = validate_scope(scope_id, scope_type, user)

                    if scope_type == NotificationScopeType.PROJECT:
                        project_ids_to_look_up.add(scope_id)
                    elif scope_type == NotificationScopeType.ORGANIZATION:
                        organization_ids_to_look_up.add(scope_id)

                    for provider_key, value_key in notifications_by_scope_id.items():
                        provider = validate_provider(provider_key)
                        value = validate_value(type, value_key)

                        notification_settings_to_update[
                            (type, scope_type, scope_id, provider)
                        ] = value

        validate_projects(project_ids_to_look_up, user=user, team=team)
        validate_organizations(organization_ids_to_look_up, user=user, team=team)

        return {
            (provider, type, scope_type, scope_id, value)
            for (
                type,
                scope_type,
                scope_id,
                provider,
            ), value in notification_settings_to_update.items()
        }
