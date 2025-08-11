from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Mapping, MutableMapping
from typing import Union

from django.db.models import Q

from sentry import features
from sentry.hybridcloud.services.organization_mapping.serial import serialize_organization_mapping
from sentry.integrations.types import (
    EXTERNAL_PROVIDERS_REVERSE_VALUES,
    PERSONAL_NOTIFICATION_PROVIDERS,
    ExternalProviderEnum,
    ExternalProviders,
)
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.team import Team
from sentry.notifications.helpers import (
    get_default_for_provider,
    get_team_members,
    get_type_defaults,
    recipient_is_team,
    recipient_is_user,
    team_is_valid_recipient,
)
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.notifications.types import (
    GroupSubscriptionStatus,
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.types.actor import Actor, ActorType
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

Recipient = Union[Actor, Team, RpcUser, User]
TEAM_NOTIFICATION_PROVIDERS = [ExternalProviderEnum.SLACK]


def sort_settings_by_scope(setting: NotificationSettingOption | NotificationSettingProvider) -> int:
    """
    Sorts settings by scope type, with the most specific scope last.
    """
    if setting.scope_type == NotificationScopeEnum.PROJECT.value:
        return 4
    if setting.scope_type == NotificationScopeEnum.ORGANIZATION.value:
        return 3
    if setting.scope_type == NotificationScopeEnum.USER.value:
        return 2
    if setting.scope_type == NotificationScopeEnum.TEAM.value:
        return 1
    return 0


class NotificationController:
    _setting_options: Iterable[NotificationSettingOption] = []
    _setting_providers: Iterable[NotificationSettingProvider] = []

    def __init__(
        self,
        recipients: Iterable[Recipient],
        project_ids: Iterable[int] | None = None,
        organization_id: int | None = None,
        type: NotificationSettingEnum | None = None,
        provider: ExternalProviderEnum | None = None,
    ) -> None:
        self.project_ids = project_ids
        self.organization_id = organization_id
        self.type = type
        self.provider = provider

        if organization_id is not None:
            org_mapping = OrganizationMapping.objects.filter(
                organization_id=organization_id
            ).first()
            org = serialize_organization_mapping(org_mapping) if org_mapping is not None else None
        else:
            org = None
        if org and features.has("organizations:team-workflow-notifications", org):
            self.recipients: list[Recipient] = []
            for recipient in recipients:
                if recipient_is_team(recipient):
                    if team_is_valid_recipient(recipient):
                        self.recipients.append(recipient)
                    else:
                        self.recipients += get_team_members(recipient)
                else:
                    self.recipients.append(recipient)
        else:
            self.recipients = list(recipients)

        if self.recipients:
            query = self._get_query()
            type_filter = Q(type=self.type.value) if self.type else Q()
            provider_filter = Q(provider=self.provider.value) if self.provider else Q()
            self._setting_options = list(
                NotificationSettingOption.objects.filter(query & type_filter)
            )
            self._setting_providers = list(
                NotificationSettingProvider.objects.filter(query & type_filter & provider_filter)
            )
        else:
            self._setting_options = []
            self._setting_providers = []

    @property
    def get_all_setting_options(self) -> Iterable[NotificationSettingOption]:
        return self._setting_options

    @property
    def get_all_setting_providers(self) -> Iterable[NotificationSettingProvider]:
        return self._setting_providers

    def _get_query(self) -> Q:
        """
        Generates a query for all settings for a project, org, user, or team.

        Args:
            recipients: The recipients of the notification settings (user or team).
            projects_ids: The projects to get notification settings for.
            organization_id: The organization to get notification settings for.
        """
        if not self.recipients:
            raise Exception("recipient, team_ids, or user_ids must be provided")

        user_ids, team_ids = [], []
        for recipient in self.recipients:
            if recipient_is_user(recipient):
                user_ids.append(recipient.id)
            elif recipient_is_team(recipient):
                team_ids.append(recipient.id)

        if not user_ids and not team_ids:
            raise Exception("recipients must be either user or team")

        project_settings = (
            Q(
                (Q(user_id__in=user_ids) | Q(team_id__in=team_ids)),
                scope_type=NotificationScopeEnum.PROJECT.value,
                scope_identifier__in=self.project_ids,
            )
            if self.project_ids
            else Q()
        )

        org_settings = (
            Q(
                (Q(user_id__in=user_ids) | Q(team_id__in=team_ids)),
                scope_type=NotificationScopeEnum.ORGANIZATION.value,
                scope_identifier=self.organization_id,
            )
            if self.organization_id
            else Q()
        )

        user_settings = (
            Q(
                Q(user_id__in=user_ids),
                scope_type=NotificationScopeEnum.USER.value,
                scope_identifier__in=user_ids,
            )
            if user_ids
            else Q()
        )

        team_settings = (
            Q(
                Q(team_id__in=team_ids),
                scope_type=NotificationScopeEnum.TEAM.value,
                scope_identifier__in=team_ids,
            )
            if team_ids
            else Q()
        )

        return project_settings | org_settings | user_settings | team_settings

    def _filter_options(
        self,
        **kwargs,
    ) -> list[NotificationSettingOption]:
        return [
            setting
            for setting in self.get_all_setting_options
            if all(getattr(setting, arg) == kwargs[arg] for arg in kwargs)
        ]

    def _filter_providers(
        self,
        **kwargs,
    ) -> list[NotificationSettingProvider]:
        return [
            setting
            for setting in self.get_all_setting_providers
            if all(getattr(setting, arg) == kwargs[arg] for arg in kwargs)
        ]

    def _get_layered_setting_options(
        self,
        project_id: int | None = None,
        **kwargs,
    ) -> MutableMapping[
        Recipient, MutableMapping[NotificationSettingEnum, NotificationSettingsOptionEnum]
    ]:
        """
        Returns a mapping of the most specific notification setting options for the given recipients and scopes.
        Note that this includes default settings for any notification types that are not set.

        Args:
            setting_type: If specified, only return settings of this type.
        """
        if self.project_ids and len(list(self.project_ids)) > 1 and not project_id:
            raise Exception("Must specify project_id if controller has more than 1 projects")

        most_specific_setting_options: MutableMapping[
            Recipient, MutableMapping[NotificationSettingEnum, NotificationSettingsOptionEnum]
        ] = defaultdict(
            lambda: defaultdict(
                lambda: NotificationSettingsOptionEnum.DEFAULT
            )  # Use lambda to return the default enum value
        )

        for recipient in self.recipients:
            # get the settings for this user/team
            filter_kwargs = kwargs.copy()
            if recipient_is_user(recipient):
                filter_kwargs["user_id"] = recipient.id
            elif recipient_is_team(recipient):
                filter_kwargs["team_id"] = recipient.id
            local_settings = self._filter_options(**filter_kwargs)
            local_settings.sort(key=sort_settings_by_scope)
            most_specific_recipient_options = most_specific_setting_options[recipient]

            for setting in local_settings:
                # if we have a project_id, make sure the setting is for that project since
                # the controller can be scoped for multiple projects
                if (
                    project_id is not None
                    and setting.scope_type == NotificationScopeEnum.PROJECT.value
                ):
                    if setting.scope_identifier != project_id:
                        continue

                # sort the settings by scope type, with the most specific scope last so we override with the most specific value
                most_specific_recipient_options[NotificationSettingEnum(setting.type)] = (
                    NotificationSettingsOptionEnum(setting.value)
                )

            # if we have no settings for this user/team, use the defaults
            for type, default in get_type_defaults().items():
                if type not in most_specific_recipient_options:
                    most_specific_recipient_options[type] = default
        return most_specific_setting_options

    def _get_layered_setting_providers(
        self,
        project_id: int | None = None,
        **kwargs,
    ) -> MutableMapping[
        Recipient,
        MutableMapping[
            NotificationSettingEnum,
            MutableMapping[str, NotificationSettingsOptionEnum],
        ],
    ]:
        """
        Returns a mapping of the most specific notification setting providers for the given recipients and scopes.
        Note that this includes default settings for any notification types that are not set.
        """
        if self.project_ids and len(list(self.project_ids)) > 2 and not project_id:
            raise Exception("Must specify project_id if controller has more than 2 projects")

        # Now, define your variable using the outermost defaultdict
        most_specific_setting_providers: MutableMapping[
            Recipient,
            MutableMapping[
                NotificationSettingEnum,
                MutableMapping[str, NotificationSettingsOptionEnum],
            ],
        ] = defaultdict(
            lambda: defaultdict(
                lambda: defaultdict(
                    lambda: NotificationSettingsOptionEnum.DEFAULT
                )  # Use lambda to return the default enum value
            )
        )

        if self.organization_id is not None:
            org_mapping = OrganizationMapping.objects.filter(
                organization_id=self.organization_id
            ).first()
            org = serialize_organization_mapping(org_mapping) if org_mapping is not None else None
        else:
            org = None
        has_team_workflow = org and features.has("organizations:team-workflow-notifications", org)

        for recipient in self.recipients:
            # get the settings for this user/team
            filter_kwargs = kwargs.copy()
            if recipient_is_user(recipient):
                filter_kwargs["user_id"] = recipient.id
            elif recipient_is_team(recipient):
                filter_kwargs["team_id"] = recipient.id

            local_settings = self._filter_providers(**filter_kwargs)
            local_settings.sort(key=sort_settings_by_scope)

            most_specific_recipient_providers = most_specific_setting_providers[recipient]
            for setting in local_settings:
                # if we have a project_id, make sure the setting is for that project since
                # the controller can be scoped for multiple projects
                if (
                    project_id is not None
                    and setting.scope_type == NotificationScopeEnum.PROJECT.value
                ):
                    if setting.scope_identifier != project_id:
                        continue
                # sort the settings by scope type, with the most specific scope last so we override with the most specific value
                most_specific_recipient_providers[NotificationSettingEnum(setting.type)][
                    ExternalProviderEnum(setting.provider).value
                ] = NotificationSettingsOptionEnum(setting.value)

            # if we have no settings for this user, use the defaults
            for type in NotificationSettingEnum:
                for provider_str in PERSONAL_NOTIFICATION_PROVIDERS:
                    provider = ExternalProviderEnum(provider_str)
                    if provider_str not in most_specific_recipient_providers[type]:
                        # TODO(jangjodi): Remove this once the flag is removed
                        if recipient_is_team(recipient) and (not has_team_workflow):
                            most_specific_recipient_providers[type][
                                provider_str
                            ] = NotificationSettingsOptionEnum.NEVER
                        else:
                            most_specific_recipient_providers[type][provider_str] = (
                                get_default_for_provider(type, provider)
                            )

        return most_specific_setting_providers

    def get_combined_settings(
        self,
        type: NotificationSettingEnum | None = None,
        actor_type: ActorType | None = None,
        project_id: int | None = None,
    ) -> MutableMapping[
        Recipient,
        MutableMapping[
            NotificationSettingEnum,
            MutableMapping[str, NotificationSettingsOptionEnum],
        ],
    ]:
        """
        Returns the co-leaved settings between the setting options and setting providers
        It is as nested as _get_layered_setting_providers by applying the value from the options
        to the provider map.
        """
        if self.type and type != self.type:
            raise Exception("Type mismatch: the provided type differs from the controller type")

        kwargs: MutableMapping[str, str] = {}
        if type:
            kwargs["type"] = type.value

        types_to_search = [type] if type else list(NotificationSettingEnum)

        setting_options_map = self._get_layered_setting_options(project_id=project_id, **kwargs)
        setting_providers_map = self._get_layered_setting_providers(project_id=project_id, **kwargs)

        result: MutableMapping[
            Recipient,
            MutableMapping[
                NotificationSettingEnum,
                MutableMapping[str, NotificationSettingsOptionEnum],
            ],
        ] = defaultdict(
            lambda: defaultdict(
                lambda: defaultdict(
                    lambda: NotificationSettingsOptionEnum.DEFAULT
                )  # Use lambda to return the default enum value
            )
        )
        for recipient, recipient_options_map in setting_options_map.items():
            # check actor type against recipient type
            if actor_type:
                if actor_type == ActorType.USER and recipient_is_team(recipient):
                    continue
                if actor_type == ActorType.TEAM and recipient_is_user(recipient):
                    continue

            for type in types_to_search:
                option_value = recipient_options_map[type]
                if option_value == NotificationSettingsOptionEnum.NEVER:
                    continue

                provider_options_map = setting_providers_map[recipient][type]
                for provider, provider_value in provider_options_map.items():
                    if provider_value == NotificationSettingsOptionEnum.NEVER:
                        continue
                    # use the option value here as it has more specific information
                    result[recipient][type][provider] = option_value

        return result

    def get_notification_recipients(
        self,
        type: NotificationSettingEnum,
        actor_type: ActorType | None = None,
        project_id: int | None = None,
    ) -> Mapping[ExternalProviders, set[Actor]]:
        """
        Returns the recipients that should be notified for each provider,
        filtered by the given notification type.

        Args:
            type: The notification type to filter providers and recipients by.
        """
        combined_settings = self.get_combined_settings(
            type=type, actor_type=actor_type, project_id=project_id
        )
        recipients: Mapping[ExternalProviders, set[Actor]] = defaultdict(set)
        for recipient, type_map in combined_settings.items():
            actor = Actor.from_object(recipient)
            for type, provider_map in type_map.items():
                for provider, value in provider_map.items():
                    if value == NotificationSettingsOptionEnum.NEVER:
                        continue

                    recipients[EXTERNAL_PROVIDERS_REVERSE_VALUES[provider]].add(actor)
        return recipients

    def get_settings_for_user_by_projects(
        self,
        user: Recipient,
        type: NotificationSettingEnum | None = None,
    ) -> MutableMapping[
        int,
        MutableMapping[
            NotificationSettingEnum,
            MutableMapping[str, NotificationSettingsOptionEnum],
        ],
    ]:
        """
        Returns a mapping of project IDs to enabled notification settings for the given user
        with an optional type filter
        """
        if not self.project_ids:
            raise Exception("Must specify project_ids")

        result: MutableMapping[
            int,
            MutableMapping[
                NotificationSettingEnum,
                MutableMapping[str, NotificationSettingsOptionEnum],
            ],
        ] = defaultdict(
            lambda: defaultdict(
                lambda: defaultdict(
                    lambda: NotificationSettingsOptionEnum.DEFAULT
                )  # Use lambda to return the default enum value
            )
        )
        for project_id in self.project_ids:
            if not isinstance(project_id, int):
                raise Exception("project_ids must be a list of integers")

            combined_settings = self.get_combined_settings(type=type, project_id=project_id)

            # take the settings for this user and apply it to the project
            result[project_id] = combined_settings[user]

        return result

    def get_subscriptions_status_for_projects(
        self,
        user: Recipient,
        project_ids: Iterable[int],
        type: NotificationSettingEnum | None = None,
    ) -> Mapping[int, GroupSubscriptionStatus]:
        """
        Returns whether the user is subscribed for each project.
        {project_id -> (is_disabled, is_active, has only inactive subscriptions)}
        """
        setting_type = type or self.type
        if not setting_type:
            raise Exception("Must specify type")

        enabled_settings = self.get_settings_for_user_by_projects(user, type=type)
        subscription_status_for_projects = {}
        for project, type_setting in enabled_settings.items():
            has_setting = False
            if project not in project_ids:
                continue

            for t, setting in type_setting.items():
                if t != setting_type:
                    continue

                has_setting = True

                subscription_status_for_projects[project] = GroupSubscriptionStatus(
                    is_disabled=setting == {},
                    is_active=any(
                        value == NotificationSettingsOptionEnum.ALWAYS for value in setting.values()
                    ),
                    has_only_inactive_subscriptions=all(
                        value == NotificationSettingsOptionEnum.NEVER for value in setting.values()
                    ),
                )

            if not has_setting:
                subscription_status_for_projects[project] = GroupSubscriptionStatus(
                    is_disabled=True, is_active=False, has_only_inactive_subscriptions=True
                )

        return subscription_status_for_projects

    def get_participants(
        self,
    ) -> MutableMapping[Actor, MutableMapping[ExternalProviders, NotificationSettingsOptionEnum]]:
        """
        Returns a mapping of recipients to the providers they should be notified on.
        Note that this returns the ExternalProviders int enum instead of the ExternalProviderEnum string.
        This helper is intended to be used with ParticipantMap, which expected int values.
        """
        if not self.type:
            raise Exception("Must specify type")

        combined_settings = self.get_combined_settings(type=self.type)
        user_to_providers: MutableMapping[
            Actor, MutableMapping[ExternalProviders, NotificationSettingsOptionEnum]
        ] = defaultdict(dict)
        for recipient, setting_map in combined_settings.items():
            actor = Actor.from_object(recipient)
            provider_map = setting_map[self.type]
            user_to_providers[actor] = {
                EXTERNAL_PROVIDERS_REVERSE_VALUES[provider]: value
                for provider, value in provider_map.items()
            }

        return user_to_providers

    def user_has_any_provider_settings(self, provider: ExternalProviderEnum | None = None) -> bool:
        """
        Returns whether the recipient has any notification settings for the given provider.

        Args:
            recipient: The recipient of the notification settings (user or team).
            provider: The provider to check for.
        """
        provider = provider or self.provider
        if not provider:
            raise Exception("Must specify provider")

        settings = self.get_all_setting_providers
        for setting in settings:
            if setting.provider != provider.value:
                continue

            if setting.value == NotificationSettingsOptionEnum.ALWAYS.value:
                return True

        return False

    def get_notification_value_for_recipient_and_type(
        self, recipient: Recipient, type: NotificationSettingEnum
    ) -> NotificationSettingsOptionEnum:
        """
        Returns the notification setting value for the given recipient and type.

        Args:
            recipient: The recipient of the notification settings (user or team).
            type: The notification type to filter providers and recipients by.
        """
        if self.type and type != self.type:
            raise Exception("Type mismatch: the provided type differs from the controller type")

        option_value_by_recipient_by_type = self._get_layered_setting_options(type=type.value)
        option_value_by_type = option_value_by_recipient_by_type[recipient]
        value = option_value_by_type[type]
        return value

    def get_notification_provider_value_for_recipient_and_type(
        self, recipient: Recipient, type: NotificationSettingEnum, provider: ExternalProviderEnum
    ) -> NotificationSettingsOptionEnum:
        """
        Returns the notification setting value for the given recipient and type.

        Args:
            recipient: The recipient of the notification settings (user or team).
            type: The notification type to filter providers and recipients by.
        """
        provider_str = provider.value
        if self.type and type != self.type:
            raise Exception("Type mismatch: the provided type differs from the controller type")

        setting_providers = self._get_layered_setting_providers(type=type.value)
        return setting_providers[recipient][type][provider_str]

    def get_users_for_weekly_reports(self) -> list[int]:
        if not self.organization_id:
            raise Exception("Must specify organization_id")

        if self.type != NotificationSettingEnum.REPORTS:
            raise Exception(f"Type mismatch: the controller was initialized with type: {self.type}")

        recipient_set = self.get_notification_recipients(
            type=NotificationSettingEnum.REPORTS,
            # only look at users
            actor_type=ActorType.USER,
        )[
            ExternalProviders.EMAIL
        ]  # email only
        return [recipient.id for recipient in recipient_set]
