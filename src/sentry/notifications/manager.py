from collections import defaultdict
from typing import (
    TYPE_CHECKING,
    Dict,
    Iterable,
    List,
    Mapping,
    MutableSet,
    Optional,
    Sequence,
    Union,
)

from django.db import transaction
from django.db.models import Q, QuerySet

from sentry import analytics, features
from sentry.db.models.manager import BaseManager
from sentry.notifications.helpers import (
    get_scope,
    get_scope_type,
    get_target_id,
    transform_to_notification_settings_by_recipient,
    validate,
    where_should_recipient_be_notified,
)
from sentry.notifications.types import (
    VALID_VALUES_FOR_KEY,
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.types.integrations import ExternalProviders
from sentry.utils.sdk import configure_scope

if TYPE_CHECKING:
    from sentry.models import NotificationSetting, Organization, Project, Team, User

REMOVE_SETTING_BATCH_SIZE = 1000


class NotificationsManager(BaseManager["NotificationSetting"]):
    """
    TODO(mgaeta): Add a caching layer for notification settings
    """

    def get_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user: Optional["User"] = None,
        team: Optional["Team"] = None,
        project: Optional["Project"] = None,
        organization: Optional["Organization"] = None,
    ) -> NotificationSettingOptionValues:
        """
        One and only one of (user, team, project, or organization)
        must not be null. This function automatically translates a missing DB
        row to NotificationSettingOptionValues.DEFAULT.
        """
        # The `unique_together` constraint should guarantee 0 or 1 rows, but
        # using `list()` rather than `.first()` to prevent Django from adding an
        # ordering that could make the query slow.
        settings = list(self.find_settings(provider, type, user, team, project, organization))[:1]
        return (
            NotificationSettingOptionValues(settings[0].value)
            if settings
            else NotificationSettingOptionValues.DEFAULT
        )

    def _update_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        value: NotificationSettingOptionValues,
        scope_type: NotificationScopeType,
        scope_identifier: int,
        target_id: int,
    ) -> None:
        """Save a NotificationSettings row."""
        with configure_scope() as scope:
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
                    scope.set_tag("notif_setting_type", setting.type_str)
                    scope.set_tag("notif_setting_value", setting.value_str)
                    scope.set_tag("notif_setting_provider", setting.provider_str)
                    scope.set_tag("notif_setting_scope", setting.scope_str)
                    setting.update(value=value.value)

    def update_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        value: NotificationSettingOptionValues,
        user: Optional["User"] = None,
        team: Optional["Team"] = None,
        project: Optional["Project"] = None,
        organization: Optional["Organization"] = None,
    ) -> None:
        """
        Save a target's notification preferences.
        Examples:
          * Updating a user's org-independent preferences
          * Updating a user's per-project preferences
          * Updating a user's per-organization preferences
        """
        target_id = get_target_id(user, team)
        analytics.record(
            "notifications.settings_updated",
            target_type="user" if user else "team",
            actor_id=target_id,
        )

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

        scope_type, scope_identifier = get_scope(user, team, project, organization)
        self._update_settings(provider, type, value, scope_type, scope_identifier, target_id)

    def remove_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user: Optional["User"] = None,
        team: Optional["Team"] = None,
        project: Optional["Project"] = None,
        organization: Optional["Organization"] = None,
    ) -> None:
        """
        We don't anticipate this function will be used by the API but is useful
        for tests. This can also be called by `update_settings` when attempting
        to set a notification preference to DEFAULT.
        """
        self.find_settings(provider, type, user, team, project, organization).delete()

    def _filter(
        self,
        provider: Optional[ExternalProviders] = None,
        type: Optional[NotificationSettingTypes] = None,
        scope_type: Optional[NotificationScopeType] = None,
        scope_identifier: Optional[int] = None,
        target_ids: Optional[Iterable[int]] = None,
    ) -> QuerySet:
        """Wrapper for .filter that translates types to actual attributes to column types."""
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

    def remove_for_user(
        self, user: "User", type: Optional[NotificationSettingTypes] = None
    ) -> None:
        """Bulk delete all Notification Settings for a USER, optionally by type."""
        self._filter(target_ids=[user.actor_id], type=type).delete()

    def remove_for_team(
        self,
        team: "Team",
        type: Optional[NotificationSettingTypes] = None,
        provider: Optional[ExternalProviders] = None,
    ) -> None:
        """Bulk delete all Notification Settings for a TEAM, optionally by type."""
        self._filter(target_ids=[team.actor_id], provider=provider, type=type).delete()

    def remove_for_project(
        self, project: "Project", type: Optional[NotificationSettingTypes] = None
    ) -> None:
        """Bulk delete all Notification Settings for a PROJECT, optionally by type."""
        self._filter(
            scope_type=NotificationScopeType.PROJECT,
            scope_identifier=project.id,
            type=type,
        ).delete()

    def remove_for_organization(
        self, organization: "Organization", type: Optional[NotificationSettingTypes] = None
    ) -> None:
        """Bulk delete all Notification Settings for an ENTIRE ORGANIZATION, optionally by type."""
        self._filter(
            scope_type=NotificationScopeType.ORGANIZATION,
            scope_identifier=organization.id,
            type=type,
        ).delete()

    def find_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user: Optional["User"] = None,
        team: Optional["Team"] = None,
        project: Optional["Project"] = None,
        organization: Optional["Organization"] = None,
    ) -> QuerySet:
        """Wrapper for .filter that translates object parameters to scopes and targets."""
        scope_type, scope_identifier = get_scope(user, team, project, organization)
        target_id = get_target_id(user, team)
        return self._filter(provider, type, scope_type, scope_identifier, [target_id])

    def get_for_user_by_projects(
        self,
        type: NotificationSettingTypes,
        user: "User",
        parents: List[Union["Organization", "Project"]],
    ) -> QuerySet:
        """
        Find all of a user's notification settings for a list of projects or
        organizations. This will include the user's parent-independent setting.
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
            type=type.value,
            target=user.actor,
        )

    def get_for_recipient_by_parent(
        self,
        type_: NotificationSettingTypes,
        parent: Union["Organization", "Project"],
        recipients: Iterable[Union["Team", "User"]],
    ) -> QuerySet:
        from sentry.models import Team, User

        """
        Find all of a project/organization's notification settings for a list of
        users or teams. Note that this WILL work with a mixed list. This will
        include each user or team's project/organization-independent settings.
        """
        user_ids: MutableSet[int] = set()
        team_ids: MutableSet[int] = set()
        actor_ids: MutableSet[int] = set()
        for recipient in recipients:
            if type(recipient) == Team:
                team_ids.add(recipient.id)
            if type(recipient) == User:
                user_ids.add(recipient.id)
            actor_ids.add(recipient.actor.id)

        # If the list would be empty, don't bother querying.
        if not actor_ids:
            return self.none()

        parent_specific_scope_type = get_scope_type(type_)
        return self.filter(
            Q(
                scope_type=parent_specific_scope_type.value,
                scope_identifier=parent.id,
            )
            | Q(
                scope_type=NotificationScopeType.USER.value,
                scope_identifier__in=user_ids,
            )
            | Q(
                scope_type=NotificationScopeType.TEAM.value,
                scope_identifier__in=team_ids,
            ),
            type=type_.value,
            target__in=actor_ids,
        )

    def filter_to_accepting_recipients(
        self,
        project: "Project",
        recipients: Iterable[Union["Team", "User"]],
    ) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
        """
        Filters a list of teams or users down to the recipients by provider who
        are subscribed to alerts. We check both the project level settings and
        global default settings.
        """
        notification_settings = self.get_for_recipient_by_parent(
            NotificationSettingTypes.ISSUE_ALERTS, parent=project, recipients=recipients
        )
        notification_settings_by_recipient = transform_to_notification_settings_by_recipient(
            notification_settings, recipients
        )
        mapping = defaultdict(set)
        should_use_slack_automatic = features.has(
            "organizations:notification-slack-automatic", project.organization
        )
        for recipient in recipients:
            providers = where_should_recipient_be_notified(
                notification_settings_by_recipient, recipient, should_use_slack_automatic
            )
            for provider in providers:
                mapping[provider].add(recipient)
        return mapping

    def get_notification_recipients(
        self, project: "Project"
    ) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
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
        return self.filter_to_accepting_recipients(project, users)

    def update_settings_bulk(
        self,
        notification_settings: Sequence["NotificationSetting"],
        user: Optional["User"] = None,
        team: Optional["Team"] = None,
    ) -> None:
        """
        Given a list of _valid_ notification settings as tuples of column
        values, save them to the DB. This does not execute as a transaction.
        """
        target_id = get_target_id(user, team)
        for (provider, type, scope_type, scope_identifier, value) in notification_settings:
            # A missing DB row is equivalent to DEFAULT.
            if value == NotificationSettingOptionValues.DEFAULT:
                self._filter(provider, type, scope_type, scope_identifier, [target_id]).delete()
            else:
                self._update_settings(
                    provider, type, value, scope_type, scope_identifier, target_id
                )
        analytics.record(
            "notifications.settings_updated",
            target_type="user" if user else "team",
            actor_id=target_id,
        )

    def remove_parent_settings_for_organization(
        self, organization: "Organization", provider: Optional[ExternalProviders] = None
    ) -> None:
        """Delete all parent-specific notification settings referencing this organization."""
        kwargs = {}
        if provider:
            kwargs["provider"] = provider.value

        project_ids = [project.id for project in organization.project_set.all()]
        self.filter(
            Q(scope_type=NotificationScopeType.PROJECT.value, scope_identifier__in=project_ids)
            | Q(
                scope_type=NotificationScopeType.ORGANIZATION.value,
                scope_identifier=organization.id,
            ),
            **kwargs,
        ).delete()

    def disable_settings_for_users(
        self, provider: ExternalProviders, users: Sequence["User"]
    ) -> None:
        """
        Given a list of users, overwrite all of their parent-independent
        notification settings to NEVER.
        TODO(mgaeta): Django 3 has self.bulk_create() which would allow us to do
         this in a single query.
        """
        for user in users:
            for type in VALID_VALUES_FOR_KEY.keys():
                self.update_or_create(
                    provider=provider.value,
                    type=type.value,
                    scope_type=NotificationScopeType.USER.value,
                    scope_identifier=user.id,
                    target_id=user.actor_id,
                    defaults={"value": NotificationSettingOptionValues.NEVER.value},
                )
