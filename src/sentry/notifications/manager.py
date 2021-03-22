from django.db import transaction
from django.db.models.query import QuerySet
from typing import Iterable, Optional

from sentry.db.models import BaseManager
from sentry.models.integration import ExternalProviders
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.models.useroption import UserOption
from sentry.notifications.legacy_mappings import (
    KEYS_TO_LEGACY_KEYS,
    get_legacy_key,
    get_legacy_value,
)


def validate(type: NotificationSettingTypes, value: NotificationSettingOptionValues):
    """
    :return: boolean. True if the "value" is valid for the "type".
    """
    return get_legacy_value(type, value) is not None


def _get_scope(user_id, project=None, organization=None):
    """
    Figure out the scope from parameters and return it as a tuple,
    TODO(mgaeta): Make sure user_id is in the project or organization.
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


def _get_target(user=None, team=None):
    """
    Figure out the target from parameters and return it as a tuple.
    :return: (int, int): (target_type, target_identifier)
    """

    if user:
        return user.actor

    if team:
        return team.actor

    raise Exception("target must be either a user or a team")


class NotificationsManager(BaseManager):
    """
    TODO(mgaeta): Add a caching layer for notification settings
    """

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
        In this temporary implementation, always read EMAIL settings from
        UserOptions. One and only one of (user, team, project, or organization)
        must not be null. This function automatically translates a missing DB
        row to NotificationSettingOptionValues.DEFAULT.
        :param provider: ExternalProviders enum
        :param type: NotificationSetting.type enum
        :param user: (optional) A User object
        :param team: (optional) A Team object
        :param project: (optional) A Project object
        :param organization: (optional) An Organization object
        :return: NotificationSettingOptionValues enum
        """
        user_id_option = getattr(user, "id", None)
        scope_type, scope_identifier = _get_scope(
            user_id_option, project=project, organization=organization
        )
        target = _get_target(user, team)

        value = (  # NOQA
            self.filter(
                provider=provider.value,
                type=type.value,
                scope_type=scope_type,
                scope_identifier=scope_identifier,
                target=target,
            ).first()
            or NotificationSettingOptionValues.DEFAULT
        )

        legacy_value = UserOption.objects.get_value(
            user, get_legacy_key(type), project=project, organization=organization
        )

        # TODO(mgaeta): This line will be valid after the "copy migration".
        # assert value == legacy_value

        return legacy_value

    def update_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        value: NotificationSettingOptionValues,
        user=None,
        team=None,
        project=None,
        organization=None,
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
        :param user: (Optional) User object
        :param team: (Optional) Team object
        :param project: (Optional) Project object
        :param organization: (Optional) Organization object
        """
        # A missing DB row is equivalent to DEFAULT.
        if value == NotificationSettingOptionValues.DEFAULT:
            return self.remove_settings(
                provider,
                type,
                user=user,
                team=team,
                project=project,
                organization=organization,
            )

        if not validate(type, value):
            raise Exception(f"value '{value}' is not valid for type '{type}'")

        user_id_option = getattr(user, "id", None)
        scope_type, scope_identifier = _get_scope(
            user_id_option, project=project, organization=organization
        )
        target = _get_target(user, team)

        key = get_legacy_key(type)
        legacy_value = get_legacy_value(type, value)

        # Annoying HACK to translate "subscribe_by_default"
        if type == NotificationSettingTypes.ISSUE_ALERTS:
            legacy_value = int(legacy_value)
            if project is None:
                key = "subscribe_by_default"

        with transaction.atomic():
            setting, created = self.get_or_create(
                provider=provider.value,
                type=type.value,
                scope_type=scope_type,
                scope_identifier=scope_identifier,
                target=target,
                defaults={"value": value.value},
            )
            if not created and setting.value != value.value:
                setting.update(value=value.value)

            UserOption.objects.set_value(
                user, key=key, value=legacy_value, project=project, organization=organization
            )

    def remove_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user=None,
        team=None,
        project=None,
        organization=None,
    ):
        """
        We don't anticipate this function will be used by the API but is useful
        for tests. This can also be called by `update_settings` when attempting
        to set a notification preference to DEFAULT.
        :param provider: ExternalProviders enum
        :param type: NotificationSettingTypes enum
        :param user: (Optional) User object
        :param team: (Optional) Team object
        :param project: (Optional) Project object
        :param organization: (Optional) Organization object
        """
        user_id_option = getattr(user, "id", None)
        scope_type, scope_identifier = _get_scope(
            user_id_option, project=project, organization=organization
        )
        target = _get_target(user, team)

        with transaction.atomic():
            self.filter(
                provider=provider.value,
                type=type.value,
                scope_type=scope_type,
                scope_identifier=scope_identifier,
                target=target,
            ).delete()

            UserOption.objects.unset_value(user, project, get_legacy_key(type))

    def _filter(
        self,
        provider: Optional[ExternalProviders] = None,
        type: Optional[NotificationSettingTypes] = None,
        scope_type: Optional[NotificationScopeType] = None,
        scope_identifier: Optional[int] = None,
        targets: Optional[Iterable] = None,
    ) -> QuerySet:
        """ Wrapper for .filter that translates types to actual attributes to column types. """
        filters = {}
        if provider:
            filters["provider"] = provider.value

        if type:
            filters["type"] = type.value

        if scope_type:
            filters["scope_type"] = scope_type.value

        if scope_identifier:
            filters["scope_identifier"] = scope_identifier

        if targets:
            filters["target__in"] = targets

        return self.filter(**filters)

    @staticmethod
    def _get_legacy_filters(type: Optional[NotificationSettingTypes] = None, **kwargs) -> dict:
        if type:
            kwargs["key"] = get_legacy_key(type)
        else:
            kwargs["key__in"] = KEYS_TO_LEGACY_KEYS.values()
        return kwargs

    def remove_for_user(self, user, type: Optional[NotificationSettingTypes] = None) -> None:
        """ Bulk delete all Notification Settings for a USER, optionally by type. """
        # We don't need a transaction because this is only used in tests.
        UserOption.objects.filter(**self._get_legacy_filters(type, user=user)).delete()
        self._filter(targets=[user.actor], type=type).delete()

    def remove_for_team(self, team, type: Optional[NotificationSettingTypes] = None) -> None:
        """ Bulk delete all Notification Settings for a TEAM, optionally by type. """
        self._filter(targets=[team.actor], type=type).delete()

    def remove_for_project(self, project, type: Optional[NotificationSettingTypes] = None) -> None:
        """ Bulk delete all Notification Settings for a PROJECT, optionally by type. """
        UserOption.objects.filter(**self._get_legacy_filters(type, project=project)).delete()
        self._filter(
            scope_type=NotificationScopeType.PROJECT,
            scope_identifier=project.id,
            type=type,
        ).delete()

    def remove_for_organization(
        self, organization, type: Optional[NotificationSettingTypes] = None
    ) -> None:
        """ Bulk delete all Notification Settings for a ENTIRE ORGANIZATION, optionally by type. """
        UserOption.objects.filter(**self._get_legacy_filters(type, project=organization)).delete()
        self._filter(
            scope_type=NotificationScopeType.ORGANIZATION,
            scope_identifier=organization.id,
            type=type,
        ).delete()

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
