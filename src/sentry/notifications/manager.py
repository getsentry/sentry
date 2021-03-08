from django.db import transaction

from sentry.db.models import BaseManager
from sentry.models.integration import ExternalProviders
from sentry.models.notificationsetting import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
    NotificationTargetType,
)
from sentry.models.useroption import UserOption
from sentry.notifications.legacy_mappings import KEYS_TO_LEGACY_KEYS, KEY_VALUE_TO_LEGACY_VALUE


def validate(type: NotificationSettingTypes, value: NotificationSettingOptionValues):
    """
    :return: boolean. True if the "value" is valid for the "type".
    """
    return _get_legacy_value(type, value) is not None


def _get_scope(user_id, project=None, organization=None):
    """
    Figure out the scope from parameters and return it as a tuple,
    TODO Add validation. Make sure user_id is in the project or organization.

    :param user_id: The user's ID
    :param project: (Optional) Project object
    :param organization: (Optional) Organization object

    :return: (int, int): (scope_type, scope_identifier)
    """

    if project:
        return NotificationScopeType.PROJECT.value, project.id

    if organization:
        return NotificationScopeType.ORGANIZATION.value, organization.id

    if user_id:
        return NotificationScopeType.USER.value, user_id

    raise Exception("scope must be either user, organization, or project")


def _get_target(user_id=None, team_id=None):
    """
    Figure out the target from parameters and return it as a tuple.

    :return: (int, int): (target_type, target_identifier)
    """

    if user_id:
        return NotificationTargetType.USER.value, user_id

    if team_id:
        return NotificationTargetType.TEAM.value, team_id

    raise Exception("target must be either a user or a team")


def _get_legacy_key(type: NotificationSettingTypes):
    """
    Temporary mapping from new enum types to legacy strings.

    :param type: NotificationSettingTypes enum
    :return: String
    """

    return KEYS_TO_LEGACY_KEYS.get(type)


def _get_legacy_value(type: NotificationSettingTypes, value: NotificationSettingOptionValues):
    """
    Temporary mapping from new enum types to legacy strings. Each type has a separate mapping.

    :param type: NotificationSettingTypes enum
    :param value: NotificationSettingOptionValues enum
    :return: String
    """

    return str(KEY_VALUE_TO_LEGACY_VALUE.get(type, {}).get(value))


class NotificationsManager(BaseManager):
    """
    TODO add a caching layer for notification settings
    """

    @staticmethod
    def notify(
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user_id=None,
        team_id=None,
        data=None,
    ):
        """
        Something noteworthy has happened. Let the targets know about what
        happened on their own terms. For each target, check their notification
        preferences and send them a message (or potentially do nothing if this
        kind of correspondence is muted.)

        :param provider: ExternalProviders enum
        :param type: NotificationSettingTypes enum
        :param user_id: User object's ID
        :param team_id: Team object's ID
        :param data: TODO describe the payload schema
        :return:
        """
        pass

    def get_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user=None,
        team=None,
        project=None,
        organization=None,
    ):
        """
        In this temporary implementation, always read EMAIL settings from UserOptions.

        :param provider: ExternalProviders enum
        :param type: NotificationSetting.type enum
        :param user: TODO
        :param team: TODO
        :param project: TODO
        :param organization: TODO

        :return: NotificationSettingOptionValues enum
        """

        user_id_option = getattr(user, "id", None)
        team_id_option = getattr(team, "id", None)
        scope_type, scope_identifier = _get_scope(
            user_id_option, project=project, organization=organization
        )
        target_type, target_identifier = _get_target(user_id_option, team_id_option)

        _value = (
            self.filter(
                provider=provider.value,
                type=type.value,
                scope_type=scope_type,
                scope_identifier=scope_identifier,
                target_type=target_type,
                target_identifier=target_identifier,
            ).first()
            or NotificationSettingOptionValues.DEFAULT
        )

        legacy_value = UserOption.objects.get_value(
            user, _get_legacy_key(type), project=project, organization=organization
        )

        # TODO assert value == legacy_value.

        return legacy_value

    def update_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        value: NotificationSettingOptionValues,
        user_id=None,
        team_id=None,
        **kwargs,
    ):
        """
        Save a target's notification preferences.

        Examples:
          * Updating a user's org-independent preferences
          * Updating a user's per-project preferences
          * Updating a user's per-organization preferences

        :param provider: ExternalProviders enum
        :param type: NotificationSettingTypes enum
        :param value: NotificationSettingOptionValues enum
        :param user_id: User object's ID
        :param team_id: Team object's ID
        :param kwargs: (deprecated) User object
        """
        # A missing DB row is equivalent to DEFAULT.
        if value == NotificationSettingOptionValues.DEFAULT:
            return self.remove_settings(provider, type, user_id=user_id, team_id=team_id, **kwargs)

        kwargs = kwargs or {}
        project_option = kwargs.get("project")
        organization_option = kwargs.get("organization")
        user_id_option = user_id or getattr(kwargs.get("user"), "id", None)
        team_id_option = team_id or getattr(kwargs.get("team"), "id", None)

        if not validate(type, value):
            raise Exception("TODO VALIDATE")

        scope_type, scope_identifier = _get_scope(
            user_id_option, project=project_option, organization=organization_option
        )
        target_type, target_identifier = _get_target(user_id_option, team_id_option)

        user = kwargs.pop("user")

        with transaction.atomic():
            setting, created = self.get_or_create(
                provider=provider.value,
                type=type.value,
                scope_type=scope_type,
                scope_identifier=scope_identifier,
                target_type=target_type,
                target_identifier=target_identifier,
                defaults={"value": value.value},
            )
            if not created and setting.value != value.value:
                setting.update(value=value.value)

            UserOption.objects.set_value(
                user, key=_get_legacy_key(type), value=_get_legacy_value(type, value), kwargs=kwargs
            )

    def remove_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user_id=None,
        team_id=None,
        **kwargs,
    ):
        """
        We don't anticipate this function will be used by the API but is useful
        for tests. This can also be called by `update_settings` when attempting
        to set a notification preference to DEFAULT.

        :param provider: ExternalProviders enum
        :param type: NotificationSettingTypes enum
        :param user_id: User object's ID
        :param team_id: Team object's ID
        :param kwargs: (deprecated) User object
        """

        kwargs = kwargs or {}
        project_option = kwargs.get("project")
        user_id_option = user_id or getattr(kwargs.get("user"), "id", None)
        team_id_option = team_id or getattr(kwargs.get("team"), "id", None)
        scope_type, scope_identifier = _get_scope(user_id_option, project=project_option)
        target_type, target_identifier = _get_target(user_id_option, team_id_option)

        user = kwargs.pop("user")

        with transaction.atomic():
            self.filter(
                provider=provider.value,
                type=type.value,
                scope_type=scope_type,
                scope_identifier=scope_identifier,
                target_type=target_type,
                target_identifier=target_identifier,
            ).delete()

            UserOption.objects.unset_value(user, project_option, _get_legacy_key(type))

    def remove_settings_for_user(self, user, type: NotificationSettingTypes = None):
        if type:
            # We don't need a transaction because this is only used in tests.
            UserOption.objects.filter(user=user, key=_get_legacy_key(type)).delete()
            self.filter(
                target_type=NotificationTargetType.USER.value,
                target_identifier=user.id,
                type=type.value,
            ).delete()
        else:
            UserOption.objects.filter(user=user, key__in=KEYS_TO_LEGACY_KEYS.values()).delete()
            self.filter(
                target_type=NotificationTargetType.USER.value,
                target_identifier=user.id,
            ).delete()

    @staticmethod
    def remove_settings_for_team():
        pass

    @staticmethod
    def remove_settings_for_project():
        pass

    @staticmethod
    def remove_settings_for_organization():
        pass

    def get_settings_for_users(
        self, provider: ExternalProviders, type: NotificationSettingTypes, users, project
    ):
        """
        Get some users' notification preferences for a given project.

        :param provider: ExternalProviders enum
        :param type: NotificationSettingTypes enum
        :param users: List of user objects
        :param project: Project object

        :return: Object mapping users' IDs to their notification preferences
        """

        return {
            user_id: value
            for user_id, value in UserOption.objects.filter(
                user__in=users, project=project, key=type.value
            ).values_list("user_id", "value")
        }
