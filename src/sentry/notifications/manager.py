from __future__ import annotations

from collections import defaultdict
from typing import (
    TYPE_CHECKING,
    Iterable,
    List,
    Mapping,
    MutableSet,
    Optional,
    Sequence,
    Set,
    Union,
)

import sentry_sdk
from django.db import transaction
from django.db.models import Q, QuerySet

from sentry import analytics
from sentry.db.models.manager import BaseManager
from sentry.models.actor import get_actor_id_for_user
from sentry.models.team import Team
from sentry.models.user import User
from sentry.notifications.defaults import NOTIFICATION_SETTINGS_ALL_SOMETIMES
from sentry.notifications.helpers import (
    get_scope,
    get_scope_type,
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
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.notifications import notifications_service
from sentry.types.integrations import ExternalProviders
from sentry.utils.sdk import configure_scope

if TYPE_CHECKING:
    from sentry.models import NotificationSetting, Organization, Project
    from sentry.services.hybrid_cloud.user import RpcUser

REMOVE_SETTING_BATCH_SIZE = 1000


class NotificationsManager(BaseManager["NotificationSetting"]):
    """
    TODO(mgaeta): Add a caching layer for notification settings
    """

    def get_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user: User | None = None,
        team: Team | None = None,
        actor: RpcActor | None = None,
        project: Project | None = None,
        organization: Organization | None = None,
    ) -> NotificationSettingOptionValues:
        """
        One and only one of (user, team, project, or organization)
        must not be null. This function automatically translates a missing DB
        row to NotificationSettingOptionValues.DEFAULT.
        """
        # The `unique_together` constraint should guarantee 0 or 1 rows, but
        # using `list()` rather than `.first()` to prevent Django from adding an
        # ordering that could make the query slow.

        settings = list(
            self.find_settings(
                provider,
                type,
                actor=actor,
                team=team,
                user=user,
                project=project,
                organization=organization,
            )
        )[:1]
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
        user_id: Optional[int] = None,
        team_id: Optional[int] = None,
    ) -> None:
        """Save a NotificationSettings row."""

        defaults = {"value": value.value}
        if user_id is not None:
            defaults.update(user_id=user_id)
        elif team_id is not None:
            defaults.update(team_id=team_id)

        with configure_scope() as scope:
            with transaction.atomic():
                setting, created = self.get_or_create(
                    provider=provider.value,
                    type=type.value,
                    scope_type=scope_type.value,
                    scope_identifier=scope_identifier,
                    target_id=target_id,
                    defaults=defaults,
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
        user: User | RpcUser | None = None,
        team: Team | None = None,
        actor: RpcActor | None = None,
        project: Project | int | None = None,
        organization: Organization | int | None = None,
    ) -> None:
        """
        Save a target's notification preferences.
        Examples:
          * Updating a user's org-independent preferences
          * Updating a user's per-project preferences
          * Updating a user's per-organization preferences
        """

        if actor is None:
            if user is not None:
                actor = RpcActor.from_object(user)
            if team is not None:
                actor = RpcActor.from_object(team)
        assert actor

        target_id = actor.actor_id
        assert target_id, "None actor_id cannot have settings updated"
        analytics.record(
            "notifications.settings_updated",
            target_type="user" if actor.actor_type == ActorType.USER else "team",
            actor_id=target_id,
            id=actor.id,
        )

        # A missing DB row is equivalent to DEFAULT.
        if value == NotificationSettingOptionValues.DEFAULT:
            return self.remove_settings(
                provider,
                type,
                actor=actor,
                project=project,
                organization=organization,
            )

        if not validate(type, value):
            raise Exception(f"value '{value}' is not valid for type '{type}'")

        scope_type, scope_identifier = get_scope(
            actor=actor, project=project, organization=organization
        )
        id_key = "user_id" if actor.actor_type == ActorType.USER else "team_id"
        self._update_settings(
            provider=provider,
            type=type,
            value=value,
            scope_type=scope_type,
            scope_identifier=scope_identifier,
            target_id=target_id,
            **{id_key: actor.id},
        )

    def remove_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user: User | None = None,
        team: Team | None = None,
        actor: RpcActor | None = None,
        project: Project | int | None = None,
        organization: Organization | int | None = None,
    ) -> None:
        """
        We don't anticipate this function will be used by the API but is useful
        for tests. This can also be called by `update_settings` when attempting
        to set a notification preference to DEFAULT.
        """
        self.find_settings(
            provider,
            type,
            actor=actor,
            team=team,
            user=user,
            project=project,
            organization=organization,
        ).delete()

    def _filter(
        self,
        provider: ExternalProviders | None = None,
        type: NotificationSettingTypes | None = None,
        scope_type: NotificationScopeType | None = None,
        scope_identifier: int | None = None,
        user_ids: Iterable[int] | None = None,
        team_ids: Iterable[int] | None = None,
    ) -> QuerySet:
        """Wrapper for .filter that translates types to actual attributes to column types."""

        try:
            assert (user_ids and not team_ids) or (
                team_ids and not user_ids
            ), "Must have user_id or team_id when reading settings"
        except AssertionError as err:
            sentry_sdk.capture_exception(err)

        query = Q()
        if provider:
            query = query & Q(provider=provider.value)

        if type:
            query = query & Q(type=type.value)

        if scope_type:
            query = query & Q(scope_type=scope_type.value)

        if scope_identifier:
            query = query & Q(scope_identifier=scope_identifier)

        if team_ids or user_ids:
            query = query & (
                Q(team_id__in=team_ids if team_ids else [])
                | Q(user_id__in=user_ids if user_ids else [])
            )

        return self.filter(query)

    def remove_for_user(self, user: User, type: NotificationSettingTypes | None = None) -> None:
        """Bulk delete all Notification Settings for a USER, optionally by type."""
        self._filter(user_ids=[user.id], type=type).delete()

    def remove_for_team(
        self,
        team: Team,
        type: NotificationSettingTypes | None = None,
        provider: ExternalProviders | None = None,
    ) -> None:
        """Bulk delete all Notification Settings for a TEAM, optionally by type."""
        self._filter(team_ids=[team.id], provider=provider, type=type).delete()

    def remove_for_project(
        self, project: Project, type: NotificationSettingTypes | None = None
    ) -> None:
        """Bulk delete all Notification Settings for a PROJECT, optionally by type."""
        self._filter(
            scope_type=NotificationScopeType.PROJECT,
            scope_identifier=project.id,
            type=type,
        ).delete()

    def remove_for_organization(
        self, organization: Organization, type: NotificationSettingTypes | None = None
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
        user: User | None = None,
        team: Team | None = None,
        actor: RpcActor | None = None,
        project: Project | int | None = None,
        organization: Organization | int | None = None,
    ) -> QuerySet:
        """Wrapper for .filter that translates object parameters to scopes and targets."""

        team_ids = set()
        user_ids = set()

        if team:
            team_ids.add(team.id)
        if user:
            user_ids.add(user.id)
        if actor:
            (team_ids if actor.actor_type == ActorType.TEAM else user_ids).add(actor.id)

        assert (team_ids and not user_ids) or (
            user_ids and not team_ids
        ), "Can only get settings for team or user"

        scope_type, scope_identifier = get_scope(
            actor=actor, team=team, user=user, project=project, organization=organization
        )
        assert (len(team_ids) == 1 and len(user_ids) == 0) or (
            len(team_ids) == 0 and len(user_ids) == 1
        ), "Cannot find settings for None actor_id"
        return self._filter(
            provider, type, scope_type, scope_identifier, team_ids=team_ids, user_ids=user_ids
        )

    def get_for_recipient_by_parent(
        self,
        type_: NotificationSettingTypes,
        parent: Organization | Project,
        recipients: Iterable[RpcActor | Team | User | RpcUser],
    ) -> QuerySet:
        """
        Find all of a project/organization's notification settings for a list of
        users or teams. Note that this WILL work with a mixed list. This will
        include each user or team's project/organization-independent settings.
        """
        user_ids: MutableSet[int] = set()
        team_ids: MutableSet[int] = set()

        for raw_recipient in recipients:
            recipient = RpcActor.from_object(raw_recipient, fetch_actor=False)
            if recipient.actor_type == ActorType.TEAM:
                team_ids.add(recipient.id)
            if recipient.actor_type == ActorType.USER:
                user_ids.add(recipient.id)

        # If the list would be empty, don't bother querying.
        if not (team_ids or user_ids):
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
            (Q(team_id__in=team_ids) | Q(user_id__in=user_ids)),
            type=type_.value,
        )

    def filter_to_accepting_recipients(
        self,
        parent: Union[Organization, Project],
        recipients: Iterable[RpcActor | Team | RpcUser],
        type: NotificationSettingTypes = NotificationSettingTypes.ISSUE_ALERTS,
    ) -> Mapping[ExternalProviders, Iterable[RpcActor]]:
        """
        Filters a list of teams or users down to the recipients by provider who
        are subscribed to alerts. We check both the project level settings and
        global default settings.
        """
        # TODO(hybridcloud) This will do N queries for actors
        recipient_actors = [RpcActor.from_object(r, fetch_actor=True) for r in recipients]

        notification_settings = notifications_service.get_settings_for_recipient_by_parent(
            type=type, parent_id=parent.id, recipients=recipient_actors
        )
        notification_settings_by_recipient = transform_to_notification_settings_by_recipient(
            notification_settings, recipient_actors
        )

        mapping = defaultdict(set)
        for recipient in recipient_actors:
            providers = where_should_recipient_be_notified(
                notification_settings_by_recipient, recipient, type
            )
            for provider in providers:
                mapping[provider].add(recipient)
        return mapping

    def get_notification_recipients(
        self, project: Project
    ) -> Mapping[ExternalProviders, Iterable[RpcActor]]:
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
        notification_settings: Sequence[NotificationSetting],
        team: Team | None = None,
        user: User | None = None,
        actor: RpcActor | None = None,
    ) -> None:
        """
        Given a list of _valid_ notification settings as tuples of column
        values, save them to the DB. This does not execute as a transaction.
        """
        if actor is None:
            if user is not None:
                # TODO(hybridcloud): set fetch_actor=False for method call below
                # when it is no longer necessary to persist NotificationSetting.target_id
                actor = RpcActor.from_object(user)
            if team is not None:
                actor = RpcActor.from_object(team)
        assert actor

        team_ids: Set[int] = set()
        user_ids: Set[int] = set()
        (team_ids if actor.actor_type == ActorType.TEAM else user_ids).add(actor.id)

        target_id = actor.actor_id
        assert target_id, "Cannot update settings for None actor_id"
        for (provider, type, scope_type, scope_identifier, value) in notification_settings:
            # A missing DB row is equivalent to DEFAULT.
            if value == NotificationSettingOptionValues.DEFAULT:
                self._filter(
                    provider,
                    type,
                    scope_type,
                    scope_identifier,
                    team_ids=team_ids,
                    user_ids=user_ids,
                ).delete()
            else:
                id_key = "user_id" if actor.actor_type == ActorType.USER else "team_id"
                self._update_settings(
                    provider,
                    type,
                    value,
                    scope_type,
                    scope_identifier,
                    target_id,
                    **{id_key: actor.id},
                )
        analytics.record(
            "notifications.settings_updated",
            target_type="user" if actor.actor_type == ActorType.USER else "team",
            actor_id=target_id,
            id=actor.id,
        )

    def remove_parent_settings_for_organization(
        self, organization_id: int, project_ids: List[int], provider: ExternalProviders
    ) -> None:
        """Delete all parent-specific notification settings referencing this organization."""
        kwargs = {}
        kwargs["provider"] = provider.value

        self.filter(
            Q(scope_type=NotificationScopeType.PROJECT.value, scope_identifier__in=project_ids)
            | Q(
                scope_type=NotificationScopeType.ORGANIZATION.value,
                scope_identifier=organization_id,
            ),
            **kwargs,
        ).delete()

    def disable_settings_for_users(
        self, provider: ExternalProviders, users: Sequence[User]
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
                    target_id=get_actor_id_for_user(user),
                    user_id=user.id,
                    defaults={"value": NotificationSettingOptionValues.NEVER.value},
                )

    def has_any_provider_settings(
        self, recipient: RpcActor | Team | User, provider: ExternalProviders
    ) -> bool:
        from sentry.models.team import Team
        from sentry.models.user import User
        from sentry.services.hybrid_cloud.user import RpcUser

        key_field = None
        if isinstance(recipient, RpcActor):
            key_field = "user_id" if recipient.actor_type == ActorType.USER else "team_id"
        if isinstance(recipient, (RpcUser, User)):
            key_field = "user_id"
        if isinstance(recipient, Team):
            key_field = "team_id"

        assert key_field, "Could not resolve key_field"

        # Explicitly typing to satisfy mypy.
        team_ids: Set[int] = set()
        user_ids: Set[int] = set()
        if isinstance(recipient, RpcActor):
            (team_ids if recipient.actor_type == ActorType.TEAM else user_ids).add(recipient.id)
        elif isinstance(recipient, Team):
            team_ids.add(recipient.id)
        elif isinstance(recipient, User):
            user_ids.add(recipient.id)

        has_settings: bool = (
            self._filter(provider=provider, team_ids=team_ids, user_ids=user_ids)
            .filter(
                value__in={
                    NotificationSettingOptionValues.ALWAYS.value,
                    NotificationSettingOptionValues.COMMITTED_ONLY.value,
                    NotificationSettingOptionValues.SUBSCRIBE_ONLY.value,
                },
                **{key_field: recipient.id},
            )
            .exists()
        )
        return has_settings

    def enable_settings_for_user(
        self,
        recipient: User | RpcUser,
        provider: ExternalProviders,
        types: set[NotificationSettingTypes] | None = None,
    ) -> None:
        for type_ in types or NOTIFICATION_SETTINGS_ALL_SOMETIMES.keys():
            self.update_settings(
                provider=provider,
                type=type_,
                value=NOTIFICATION_SETTINGS_ALL_SOMETIMES[type_],
                actor=RpcActor.from_object(recipient),
                user=recipient,
            )
