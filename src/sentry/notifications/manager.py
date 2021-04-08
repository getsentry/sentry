from typing import Any, DefaultDict, Dict, Iterable, List, Optional, Union

from django.db import transaction
from django.db.models import Q, QuerySet
from collections import defaultdict

from sentry.db.models.manager import BaseManager
from sentry.models.integration import ExternalProviders
from sentry.notifications.helpers import (
    get_scope,
    get_scope_type,
    get_target_id,
    transform_to_notification_settings_by_user,
    where_should_user_be_notified,
    validate,
)
from sentry.notifications.legacy_mappings import (
    KEYS_TO_LEGACY_KEYS,
    get_legacy_key,
    get_legacy_value,
)
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)


class NotificationsManager(BaseManager):  # type: ignore
    """
    TODO(mgaeta): Add a caching layer for notification settings
    """

    def get_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user: Optional[Any] = None,
        team: Optional[Any] = None,
        project: Optional[Any] = None,
        organization: Optional[Any] = None,
    ) -> NotificationSettingOptionValues:
        """
        In this temporary implementation, always read EMAIL settings from
        UserOptions. One and only one of (user, team, project, or organization)
        must not be null. This function automatically translates a missing DB
        row to NotificationSettingOptionValues.DEFAULT.
        """
        from sentry.models.useroption import UserOption

        # The `unique_together` constraint should guarantee 0 or 1 rows, but
        # using `list()` rather than `.first()` to prevent Django from adding an
        # ordering that could make the query slow.
        settings = list(self.find_settings(provider, type, user, team, project, organization))[:1]
        value = (
            NotificationSettingOptionValues(settings[0].value)
            if settings
            else NotificationSettingOptionValues.DEFAULT
        )

        legacy_value = UserOption.objects.get_value(
            user, get_legacy_key(type), project=project, organization=organization
        )

        expected_legacy_value = get_legacy_value(type, value)
        assert expected_legacy_value == str(legacy_value), (expected_legacy_value, legacy_value)

        return value

    def update_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        value: NotificationSettingOptionValues,
        user: Optional[Any] = None,
        team: Optional[Any] = None,
        project: Optional[Any] = None,
        organization: Optional[Any] = None,
    ) -> None:
        """
        Save a target's notification preferences.
        Examples:
          * Updating a user's org-independent preferences
          * Updating a user's per-project preferences
          * Updating a user's per-organization preferences
        """
        from sentry.models.useroption import UserOption

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
        scope_type, scope_identifier = get_scope(
            user_id_option, project=project, organization=organization
        )
        target_id = get_target_id(user, team)

        key = get_legacy_key(type)
        legacy_value: Union[str, int] = get_legacy_value(type, value)

        # Annoying HACK to translate "subscribe_by_default"
        if type == NotificationSettingTypes.ISSUE_ALERTS:
            legacy_value = int(legacy_value)
            if project is None:
                key = "subscribe_by_default"

        with transaction.atomic():
            setting, created = self.get_or_create(
                provider=provider.value,
                type=type.value,
                scope_type=scope_type.value,
                scope_identifier=scope_identifier,
                target_id=target_id,
                defaults={"value": value.value},
            )
            if not created and setting.value != value.value:
                setting.update(value=value.value)

            if not team:
                UserOption.objects.set_value(
                    user, key=key, value=legacy_value, project=project, organization=organization
                )

    def remove_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user: Optional[Any] = None,
        team: Optional[Any] = None,
        project: Optional[Any] = None,
        organization: Optional[Any] = None,
    ) -> None:
        """
        We don't anticipate this function will be used by the API but is useful
        for tests. This can also be called by `update_settings` when attempting
        to set a notification preference to DEFAULT.
        """
        from sentry.models.useroption import UserOption

        with transaction.atomic():
            self.find_settings(provider, type, user, team, project, organization).delete()
            UserOption.objects.unset_value(user, project, get_legacy_key(type))

    def _filter(
        self,
        provider: Optional[ExternalProviders] = None,
        type: Optional[NotificationSettingTypes] = None,
        scope_type: Optional[NotificationScopeType] = None,
        scope_identifier: Optional[int] = None,
        target_ids: Optional[Iterable[int]] = None,
    ) -> QuerySet:
        """ Wrapper for .filter that translates types to actual attributes to column types. """
        filters: Dict[str, Union[int, Iterable[int]]] = {}
        if provider:
            filters["provider"] = provider.value

        if type:
            filters["type"] = type.value

        if scope_type:
            filters["scope_type"] = scope_type.value

        if scope_identifier:
            filters["scope_identifier"] = scope_identifier

        if target_ids:
            filters["target_id__in"] = target_ids

        return self.filter(**filters)

    @staticmethod
    def remove_legacy_option(
        type: Optional[NotificationSettingTypes] = None, **kwargs: Any
    ) -> None:
        from sentry.models.useroption import UserOption

        if type:
            kwargs["key"] = get_legacy_key(type)
        else:
            kwargs["key__in"] = KEYS_TO_LEGACY_KEYS.values()

        UserOption.objects.filter(**kwargs).delete()

    def remove_for_user(self, user: Any, type: Optional[NotificationSettingTypes] = None) -> None:
        """ Bulk delete all Notification Settings for a USER, optionally by type. """
        # We don't need a transaction because this is only used in tests.
        self.remove_legacy_option(type, user=user)
        self._filter(target_ids=[user.actor_id], type=type).delete()

    def remove_for_team(self, team: Any, type: Optional[NotificationSettingTypes] = None) -> None:
        """ Bulk delete all Notification Settings for a TEAM, optionally by type. """
        self._filter(target_ids=[team.actor_id], type=type).delete()

    def remove_for_project(
        self, project: Any, type: Optional[NotificationSettingTypes] = None
    ) -> None:
        """ Bulk delete all Notification Settings for a PROJECT, optionally by type. """
        self.remove_legacy_option(type, project=project)
        self._filter(
            scope_type=NotificationScopeType.PROJECT,
            scope_identifier=project.id,
            type=type,
        ).delete()

    def remove_for_organization(
        self, organization: Any, type: Optional[NotificationSettingTypes] = None
    ) -> None:
        """ Bulk delete all Notification Settings for an ENTIRE ORGANIZATION, optionally by type. """
        self.remove_legacy_option(type, organization=organization)
        self._filter(
            scope_type=NotificationScopeType.ORGANIZATION,
            scope_identifier=organization.id,
            type=type,
        ).delete()

    def find_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user: Optional[Any] = None,
        team: Optional[Any] = None,
        project: Optional[Any] = None,
        organization: Optional[Any] = None,
    ) -> QuerySet:
        """ Wrapper for .filter that translates object parameters to scopes and targets. """
        user_id_option = getattr(user, "id", None)
        scope_type, scope_identifier = get_scope(
            user_id_option, project=project, organization=organization
        )
        target_id = get_target_id(user, team)
        return self._filter(provider, type, scope_type, scope_identifier, [target_id])

    def get_for_user_by_projects(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user: Any,
        parents: List[Any],
    ) -> QuerySet:
        """
        Find all of a user's notification settings for a list of projects or organizations.
        This will include the user's  setting.
        """
        scope_type = get_scope_type(type)
        return self.filter(
            Q(
                scope_type=scope_type.value,
                scope_identifier__in=[parent.id for parent in parents],
            )
            | Q(
                scope_type=NotificationScopeType.USER.value,
                scope_identifier=user.id,
            ),
            provider=provider.value,
            type=type.value,
            target=user.actor,
        )

    def get_for_users_by_parent(
        self,
        type: NotificationSettingTypes,
        parent: Any,
        users: List[Any],
    ) -> QuerySet:
        """
        Find all of a project/organization's notification settings for a list of users.
        This will include each user's project/organization-independent settings.
        """
        scope_type = get_scope_type(type)
        return self.filter(
            Q(
                scope_type=scope_type.value,
                scope_identifier=parent.id,
            )
            | Q(
                scope_type=NotificationScopeType.USER.value,
                scope_identifier__in=[user.id for user in users],
            ),
            type=type.value,
            target__in=[user.actor.id for user in users],
        )

    def filter_to_subscribed_users(
        self,
        provider: ExternalProviders,
        project: Any,
        users: List[Any],
    ) -> DefaultDict[Any, List[Any]]:
        """
        Filters a list of users down to the users by provider who are subscribed to alerts.
        We check both the project level settings and global default settings.
        """
        notification_settings = self.get_for_users_by_parent(
            NotificationSettingTypes.ISSUE_ALERTS, parent=project, users=users
        )
        notification_settings_by_user = transform_to_notification_settings_by_user(
            notification_settings, users
        )
        mapping = defaultdict(list)
        for user in users:
            providers = where_should_user_be_notified(notification_settings_by_user, user)
            for provider in providers:
                mapping[provider].append(user)
        return mapping

    def get_notification_recipients(
        self, provider: ExternalProviders, project: Any
    ) -> DefaultDict[Any, List[Any]]:
        """
        Return a set of users that should receive Issue Alert emails for a given
        project. To start, we get the set of all users. Then we fetch all of
        their relevant notification settings and put them into reference
        dictionary. Finally, we traverse the set of users and return the ones
        that should get a notification.
        """
        from sentry.models.user import User

        user_ids = project.member_set.values_list("user", flat=True)
        users = User.objects.filter(id__in=user_ids)
        return self.filter_to_subscribed_users(provider, project, users)

    def update_settings_bulk(
        self,
        notification_settings: Iterable[Any],
        target_id: int,
    ) -> None:
        """
        Given a list of _valid_ notification settings as tuples of column
        values, save them to the DB. This does not execute as a transaction.
        """

        for (type, scope_type, scope_identifier, provider, value) in notification_settings:
            # A missing DB row is equivalent to DEFAULT.
            if value == NotificationSettingOptionValues.DEFAULT:
                self._filter(provider, type, scope_type, scope_identifier, [target_id]).delete()
            else:
                with transaction.atomic():
                    setting, created = self.get_or_create(
                        provider=provider.value,
                        type=type.value,
                        scope_type=scope_type.value,
                        scope_identifier=scope_identifier,
                        target_id=target_id,
                        defaults={"value": value.value},
                    )
                    if not created and setting.value != value.value:
                        setting.update(value=value.value)
