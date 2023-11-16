from __future__ import annotations

import logging
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

from django.db import router, transaction
from django.db.models import Q, QuerySet

from sentry import analytics
from sentry.db.models.manager import BaseManager
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.models.user import User
from sentry.notifications.defaults import NOTIFICATION_SETTINGS_ALL_SOMETIMES
from sentry.notifications.helpers import get_scope, get_scope_type, validate
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.types import (
    NOTIFICATION_SCOPE_TYPE,
    NOTIFICATION_SETTING_OPTION_VALUES,
    NOTIFICATION_SETTING_TYPES,
    VALID_VALUES_FOR_KEY,
    VALID_VALUES_FOR_KEY_V2,
    NotificationScopeEnum,
    NotificationScopeType,
    NotificationSettingEnum,
    NotificationSettingOptionValues,
    NotificationSettingsOptionEnum,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.types.integrations import (
    EXTERNAL_PROVIDERS,
    PERSONAL_NOTIFICATION_PROVIDERS,
    ExternalProviders,
)
from sentry.utils.sdk import configure_scope

if TYPE_CHECKING:
    from sentry.models.notificationsetting import NotificationSetting  # noqa: F401
    from sentry.models.organization import Organization

REMOVE_SETTING_BATCH_SIZE = 1000
logger = logging.getLogger(__name__)


class NotificationsManager(BaseManager["NotificationSetting"]):
    """
    TODO(mgaeta): Add a caching layer for notification settings
    """

    def get_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user_id: int | None = None,
        team_id: int | None = None,
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
                team_id=team_id,
                user_id=user_id,
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
        user_id: Optional[int] = None,
        team_id: Optional[int] = None,
    ) -> None:
        """Save a NotificationSettings row."""
        from sentry.models.notificationsetting import NotificationSetting  # noqa: F811

        defaults = {"value": value.value}
        with configure_scope() as scope:
            with transaction.atomic(router.db_for_write(NotificationSetting)):
                setting, created = self.get_or_create(
                    provider=provider.value,
                    type=type.value,
                    scope_type=scope_type.value,
                    scope_identifier=scope_identifier,
                    user_id=user_id,
                    team_id=team_id,
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
        user: User | None = None,
        user_id: int | None = None,
        team_id: int | None = None,
        project: Project | int | None = None,
        organization: Organization | int | None = None,
        actor: RpcActor | None = None,
        skip_provider_updates: bool = False,
        organization_id_for_team: Optional[int] = None,
    ) -> None:
        """
        Save a target's notification preferences.
        Examples:
          * Updating a user's org-independent preferences
          * Updating a user's per-project preferences
          * Updating a user's per-organization preferences
        """
        if user:
            user_id = user.id
        elif actor:
            if actor.actor_type == ActorType.USER:
                user_id = actor.id
            else:
                team_id = actor.id

        if user_id is not None:
            actor_type = ActorType.USER
            actor_id = user_id

        if team_id is not None:
            actor_type = ActorType.TEAM
            actor_id = team_id
        assert actor_type, "None actor cannot have settings updated"

        analytics.record(
            "notifications.settings_updated",
            target_type="user" if actor_type == ActorType.USER else "team",
            actor_id=None,
            id=actor_id,
        )

        scope_type, scope_identifier = get_scope(
            team=team_id, user=user_id, project=project, organization=organization
        )
        # A missing DB row is equivalent to DEFAULT.
        if value == NotificationSettingOptionValues.DEFAULT:
            self.remove_settings(
                provider,
                type,
                user_id=user_id,
                team_id=team_id,
                project=project,
                organization=organization,
                organization_id_for_team=organization_id_for_team,
            )
        else:
            if not validate(type, value):
                raise Exception(f"value '{value}' is not valid for type '{type}'")

            id_key = "user_id" if actor_type == ActorType.USER else "team_id"
            self._update_settings(
                provider=provider,
                type=type,
                value=value,
                scope_type=scope_type,
                scope_identifier=scope_identifier,
                **{id_key: actor_id},
            )

        # implement the double write now
        query_args = {
            "type": NOTIFICATION_SETTING_TYPES[type],
            "scope_type": NOTIFICATION_SCOPE_TYPE[scope_type],
            "scope_identifier": scope_identifier,
            "user_id": user_id,
            "team_id": team_id,
        }
        # if default, delete the row
        if value == NotificationSettingOptionValues.DEFAULT:
            NotificationSettingOption.objects.filter(**query_args).delete()

        else:
            NotificationSettingOption.objects.create_or_update(
                **query_args,
                values={"value": NOTIFICATION_SETTING_OPTION_VALUES[value]},
            )
        if not skip_provider_updates:
            self.update_provider_settings(user_id, team_id)

    def remove_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user: User | None = None,
        user_id: int | None = None,
        team_id: int | None = None,
        project: Project | int | None = None,
        organization: Organization | int | None = None,
        organization_id_for_team: Optional[int] = None,
    ) -> None:
        """
        We don't anticipate this function will be used by the API but is useful
        for tests. This can also be called by `update_settings` when attempting
        to set a notification preference to DEFAULT.
        """
        if user:
            user_id = user.id

        # get the actor type and actor id
        scope_type, scope_identifier = get_scope(
            team=team_id, user=user_id, project=project, organization=organization
        )
        scope_type_str = NOTIFICATION_SCOPE_TYPE[scope_type]
        # remove the option setting
        NotificationSettingOption.objects.filter(
            scope_type=scope_type_str,
            scope_identifier=scope_identifier,
            team_id=team_id,
            user_id=user_id,
            type=type,
        ).delete()
        # the provider setting is updated elsewhere

        self.find_settings(
            provider,
            type,
            team_id=team_id,
            user_id=user_id,
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

    # only used in tests
    def remove_for_user(self, user: User, type: NotificationSettingTypes | None = None) -> None:
        """Bulk delete all Notification Settings for a USER, optionally by type."""
        self._filter(user_ids=[user.id], type=type).delete()

    def remove_for_project(
        self, project_id: int, type: NotificationSettingTypes | None = None
    ) -> None:
        """Bulk delete all Notification Settings for a PROJECT, optionally by type."""
        self._filter(
            scope_type=NotificationScopeType.PROJECT,
            scope_identifier=project_id,
            type=type,
        ).delete()

    def remove_for_organization(
        self, organization_id: int, type: NotificationSettingTypes | None = None
    ) -> None:
        """Bulk delete all Notification Settings for an ENTIRE ORGANIZATION, optionally by type."""
        self._filter(
            scope_type=NotificationScopeType.ORGANIZATION,
            scope_identifier=organization_id,
            type=type,
        ).delete()

    def find_settings(
        self,
        provider: ExternalProviders,
        type: NotificationSettingTypes,
        user_id: int | None = None,
        team_id: int | None = None,
        project: Project | int | None = None,
        organization: Organization | int | None = None,
    ) -> QuerySet:
        """Wrapper for .filter that translates object parameters to scopes and targets."""

        team_ids = set()
        user_ids = set()

        if team_id:
            team_ids.add(team_id)
        if user_id:
            user_ids.add(user_id)

        assert (team_ids and not user_ids) or (
            user_ids and not team_ids
        ), "Can only get settings for team or user"

        scope_type, scope_identifier = get_scope(
            team=team_id, user=user_id, project=project, organization=organization
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
        recipients: Iterable[RpcActor | Team | RpcUser | User],
        type: NotificationSettingTypes = NotificationSettingTypes.ISSUE_ALERTS,
    ) -> Mapping[ExternalProviders, Iterable[RpcActor]]:
        """
        Filters a list of teams or users down to the recipients by provider who
        are subscribed to alerts. We check both the project level settings and
        global default settings.
        """
        recipient_actors = RpcActor.many_from_object(recipients)

        if isinstance(parent, Project):
            organization = parent.organization
            project_ids = [parent.id]
        else:
            organization = parent
            project_ids = None

        setting_type = (
            NotificationSettingEnum(NOTIFICATION_SETTING_TYPES[type])
            if type
            else NotificationSettingEnum.ISSUE_ALERTS
        )
        controller = NotificationController(
            recipients=recipient_actors,
            project_ids=project_ids,
            organization_id=organization.id,
            type=setting_type,
        )

        return controller.get_notification_recipients(type=setting_type)

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

        user_ids = project.member_set.values_list("user_id", flat=True)
        return self.filter_to_accepting_recipients(
            project, {RpcUser(id=user_id) for user_id in user_ids}
        )

    def update_provider_settings(self, user_id: int | None, team_id: int | None):
        """
        Find all settings for a team/user, determine the provider settings and map it to the parent scope
        """
        assert team_id or user_id, "Cannot update settings if user or team is not passed"

        parent_scope_type = (
            NotificationScopeEnum.TEAM if team_id is not None else NotificationScopeEnum.USER
        )
        parent_scope_identifier = team_id if team_id is not None else user_id

        # Get all the NotificationSetting rows for the user or team at the top level scope
        notification_settings = self.filter(
            user_id=user_id,
            team_id=team_id,
            scope_type__in=[
                NotificationScopeType.USER.value,
                NotificationScopeType.TEAM.value,
            ],
        )
        # Initialize a dictionary to store the new NotificationSettingProvider values
        enabled_providers_by_type: Mapping[str, Set[str]] = defaultdict(set)
        disabled_providers_by_type: Mapping[str, Set[str]] = defaultdict(set)

        # Iterate through all the stored NotificationSetting rows
        for setting in notification_settings:
            provider = EXTERNAL_PROVIDERS[setting.provider]
            type = setting.type
            if setting.value == NotificationSettingOptionValues.NEVER.value:
                disabled_providers_by_type[type].add(provider)
            else:
                # if the value is not never, it's explicitly enabled
                enabled_providers_by_type[type].add(provider)

        # This is a bad N+1 query but we don't have a better way to do this
        for provider in PERSONAL_NOTIFICATION_PROVIDERS:
            types_to_delete = []
            # iterate throuch each type of notification setting
            base_query = {
                "provider": provider,
                "user_id": user_id,
                "team_id": team_id,
                "scope_type": parent_scope_type.value,
                "scope_identifier": parent_scope_identifier,
            }
            for type in VALID_VALUES_FOR_KEY_V2.keys():
                query_args = {
                    **base_query,
                    "type": NOTIFICATION_SETTING_TYPES[type],
                }
                if provider in enabled_providers_by_type[type]:
                    NotificationSettingProvider.objects.create_or_update(
                        **query_args,
                        values={"value": NotificationSettingsOptionEnum.ALWAYS.value},
                    )
                elif provider in disabled_providers_by_type[type]:
                    NotificationSettingProvider.objects.create_or_update(
                        **query_args,
                        values={"value": NotificationSettingsOptionEnum.NEVER.value},
                    )
                    # if not explicitly enabled or disable, we should delete the row
                else:
                    types_to_delete.append(type)
            # delete the rows that are not explicitly enabled or disabled
            NotificationSettingProvider.objects.filter(
                **base_query,
                type__in=[NOTIFICATION_SETTING_TYPES[type] for type in types_to_delete],
            ).delete()

    def update_settings_bulk(
        self,
        notification_settings: Sequence[
            tuple[
                ExternalProviders,
                NotificationSettingTypes,
                NotificationScopeType,
                int,
                NotificationSettingOptionValues,
            ]
        ],
        team: Team | None = None,
        user: User | None = None,
        organization_id_for_team: Optional[int] = None,
    ) -> None:
        assert user or team, "Cannot update settings if user or team is not passed"
        """
        Given a list of _valid_ notification settings as tuples of column
        values, save them to the DB. This does not execute as a transaction.
        """
        team_ids: Set[int] = set()
        user_ids: Set[int] = set()

        if user is not None:
            user_ids.add(user.id)
            id_key = "user_id"
            id = user.id
        if team is not None:
            team_ids.add(team.id)
            id_key = "team_id"
            id = team.id

        for provider, type, scope_type, scope_identifier, value in notification_settings:
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
                self._update_settings(
                    provider,
                    type,
                    value,
                    scope_type,
                    scope_identifier,
                    **{id_key: id},
                )
        analytics.record(
            "notifications.settings_updated",
            target_type="user" if user is not None else "team",
            actor_id=None,
            id=id,
        )

        user_id = user.id if user else None
        team_id = team.id if team else None

        enabled_providers = defaultdict(set)
        disabled_providers = defaultdict(set)
        defaulted_providers = defaultdict(set)
        all_settings = set()
        # we need to know which kind of enabled it is
        # note for a given type/scope, all the enabled ones will be the same
        enabled_value_dict = {}

        # group the type, scope_type, scope_identifier, together and get store the explicitly enabled/disabled providers
        for provider, type, scope_type, scope_identifier, value in notification_settings:
            # Group the type, scope_type, scope_identifier together
            group_key = (type, scope_type, scope_identifier)
            all_settings.add(group_key)
            # Initialize the dictionaries to store the explicitly enabled/disabled providers

            # Check the value and add the provider to the corresponding dictionary
            if value == NotificationSettingOptionValues.NEVER:
                disabled_providers[group_key].add(provider)
            elif value == NotificationSettingOptionValues.DEFAULT:
                defaulted_providers[group_key].add(provider)
            else:
                enabled_providers[group_key].add(provider)
                enabled_value_dict[group_key] = value

        # iterate through all the settings and create/update the NotificationSettingOption
        for group_key in all_settings:
            (type, scope_type, scope_identifier) = group_key
            query_args = {
                "type": NOTIFICATION_SETTING_TYPES[type],
                "scope_type": NOTIFICATION_SCOPE_TYPE[scope_type],
                "scope_identifier": scope_identifier,
                "user_id": user_id,
                "team_id": team_id,
            }

            # if any settings are default, we should remove the row
            if len(defaulted_providers[group_key]) > 0:
                NotificationSettingOption.objects.filter(**query_args).delete()
            # if any of the providers are explicitly enabled, we should create/update the row
            if len(enabled_providers[group_key]) > 0:
                value_to_use = (
                    NOTIFICATION_SETTING_OPTION_VALUES[enabled_value_dict[group_key]]
                    if group_key in enabled_value_dict
                    else NotificationSettingsOptionEnum.ALWAYS.value
                )
                NotificationSettingOption.objects.create_or_update(
                    **query_args,
                    values={"value": value_to_use},
                )
            # if any settings are explicitly disabled, we should create/update the row
            elif len(disabled_providers[group_key]) > 0:
                NotificationSettingOption.objects.create_or_update(
                    **query_args,
                    values={"value": NotificationSettingsOptionEnum.NEVER.value},
                )

        # update the provider settings after we update the NotificationSettingOption
        self.update_provider_settings(user_id, team_id)

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
        self, provider: ExternalProviders, users: Iterable[User]
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
                    user_id=user.id,
                    defaults={"value": NotificationSettingOptionValues.NEVER.value},
                )

    def has_any_provider_settings(
        self, recipient: RpcActor | Team | User, provider: ExternalProviders
    ) -> bool:
        from sentry.models.team import Team
        from sentry.models.user import User

        key_field = None
        if isinstance(recipient, RpcActor):
            key_field = "user_id" if recipient.actor_type == ActorType.USER else "team_id"
        if isinstance(recipient, (RpcUser, User)):
            key_field = "user_id"
        if isinstance(recipient, Team):
            key_field = "team_id"

        assert key_field, "Could not resolve key_field"

        team_ids: Set[int] = set()
        user_ids: Set[int] = set()
        if isinstance(recipient, RpcActor):
            (team_ids if recipient.actor_type == ActorType.TEAM else user_ids).add(recipient.id)
        elif isinstance(recipient, Team):
            team_ids.add(recipient.id)
        elif isinstance(recipient, User):
            user_ids.add(recipient.id)

        return (
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
                user_id=recipient.id,
            )
