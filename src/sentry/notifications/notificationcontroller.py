from __future__ import annotations

from collections import defaultdict
from typing import Iterable, Mapping, MutableMapping, Tuple, Union

from django.db.models import Q

from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.team import Team
from sentry.notifications.helpers import (
    get_default_for_provider,
    get_type_defaults,
    recipient_is_team,
    recipient_is_user,
)
from sentry.notifications.types import (
    GroupSubscriptionStatus,
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.types.integrations import (
    EXTERNAL_PROVIDERS_REVERSE,
    PERSONAL_NOTIFICATION_PROVIDERS,
    ExternalProviderEnum,
    ExternalProviders,
)

Recipient = Union[RpcActor, Team, RpcUser]
Scope = Tuple[NotificationScopeEnum, Union[int, Recipient]]


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
        recipients: Iterable[RpcActor] | Iterable[Team] | Iterable[RpcUser],
        project_ids: Iterable[int] | None = None,
        organization_id: int | None = None,
        type: NotificationSettingEnum | None = None,
        provider: ExternalProviderEnum | None = None,
    ) -> None:
        self.recipients = recipients
        self.project_ids = project_ids
        self.organization_id = organization_id
        self.type = type
        self.provider = provider

        if recipients:
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

        team_or_user_settings = Q(
            (Q(user_id__in=user_ids) | Q(team_id__in=team_ids)),
            scope_type=NotificationScopeEnum.USER.value,
            scope_identifier__in=user_ids,
        )

        return project_settings | org_settings | team_or_user_settings

    def _get_scope_for_layering(
        self, recipient: RpcActor | Team | RpcUser
    ) -> Iterable[Tuple[NotificationScopeEnum, int | RpcActor | Team | RpcUser]]:
        if self.project_ids:
            return (NotificationScopeEnum.PROJECT, self.project_ids)
        if self.organization_id is not None:
            return (NotificationScopeEnum.ORGANIZATION, [self.organization_id])
        if recipient_is_user(recipient):
            return (NotificationScopeEnum.USER, [recipient])
        if recipient_is_team(recipient):
            return (NotificationScopeEnum.TEAM, [recipient])

        raise ValueError(f"Recipient is of unsupported type: {recipient}")

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

        most_specific_setting_options: MutableMapping[
            Recipient, MutableMapping[NotificationSettingEnum, NotificationSettingsOptionEnum]
        ] = defaultdict(lambda: defaultdict(dict))

        for recipient in self.recipients:
            # get the settings for this user/team
            filter_kwargs = kwargs.copy()
            if recipient_is_user(recipient):
                filter_kwargs["user_id"] = recipient.id
            elif recipient_is_team(recipient):
                filter_kwargs["team_id"] = recipient.id

            # TODO: need the ability to filter to specific projects
            local_settings = self._filter_options(**filter_kwargs)
            most_specific_recipient_options = most_specific_setting_options[recipient]

            for setting in local_settings:
                # sort the settings by scope type, with the most specific scope last so we override with the most specific value
                local_settings.sort(key=sort_settings_by_scope)
                most_specific_recipient_options[
                    NotificationSettingEnum(setting.type)
                ] = NotificationSettingsOptionEnum(setting.value)

            # if we have no settings for this user/team, use the defaults
            for type, default in get_type_defaults().items():
                if type not in most_specific_recipient_options:
                    most_specific_recipient_options[type] = default

        return most_specific_setting_options

    def _get_layered_setting_providers(
        self,
        **kwargs,
    ) -> MutableMapping[
        Recipient,
        MutableMapping[
            NotificationSettingEnum,
            MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum],
        ],
    ]:
        """
        Returns a mapping of the most specific notification setting providers for the given recipients and scopes.
        Note that this includes default settings for any notification types that are not set.
        """
        most_specific_setting_providers: MutableMapping[
            Recipient,
            MutableMapping[
                NotificationSettingEnum,
                MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum],
            ],
        ] = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))

        for recipient in self.recipients:
            # get the settings for this user/team
            filter_kwargs = kwargs.copy()
            if recipient_is_user(recipient):
                filter_kwargs["user_id"] = recipient.id
            elif recipient_is_team(recipient):
                filter_kwargs["team_id"] = recipient.id

            local_settings = self._filter_providers(**filter_kwargs)
            most_specific_recipient_providers = most_specific_setting_providers[recipient]

            for setting in local_settings:
                # sort the settings by scope type, with the most specific scope last so we override with the most specific value
                local_settings.sort(key=sort_settings_by_scope)
                most_specific_recipient_providers[NotificationSettingEnum(setting.type)][
                    ExternalProviderEnum(setting.provider)
                ] = NotificationSettingsOptionEnum(setting.value)

            # if we have no settings for this user, use the defaults
            for type in NotificationSettingEnum:
                for provider_str in PERSONAL_NOTIFICATION_PROVIDERS:
                    provider = ExternalProviderEnum(provider_str)
                    if provider not in most_specific_recipient_providers[type]:
                        # TODO: fix so team defaults don't have differnet logic
                        if recipient_is_team(recipient):
                            most_specific_recipient_providers[type][
                                provider
                            ] = NotificationSettingsOptionEnum.NEVER
                        else:
                            most_specific_recipient_providers[type][
                                provider
                            ] = get_default_for_provider(type, provider)

        return most_specific_setting_providers

    def get_notification_recipients(
        self,
        type: NotificationSettingEnum,
        actor_type: ActorType | None = None,
    ) -> Mapping[ExternalProviders, set[RpcActor]]:
        """
        Returns the recipients that should be notified for each provider,
        filtered by the given notification type.

        Args:
            type: The notification type to filter providers and recipients by.
        """
        if self.type and type != self.type:
            raise Exception("Type mismatch: the provided type differs from the controller type")

        setting_options_map = self._get_layered_setting_options(type=type.value)
        setting_providers_map = self._get_layered_setting_providers(type=type.value)

        recipients: Mapping[ExternalProviders, set[RpcActor]] = defaultdict(set)
        for recipient, recipient_options_map in setting_options_map.items():
            actor = RpcActor.from_object(recipient)
            if actor_type and actor.actor_type != actor_type:
                continue

            option_value = recipient_options_map[type]
            if option_value == NotificationSettingsOptionEnum.NEVER:
                continue

            provider_options_map = setting_providers_map[recipient][type]
            for provider, provider_value in provider_options_map.items():
                if provider_value == NotificationSettingsOptionEnum.NEVER:
                    continue

                recipients[EXTERNAL_PROVIDERS_REVERSE[provider]].add(actor)
        return recipients

    def get_all_enabled_settings(
        self,
        **kwargs,
    ) -> MutableMapping[
        Recipient,
        MutableMapping[
            Scope,
            MutableMapping[
                NotificationSettingEnum,
                MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum],
            ],
        ],
    ]:
        """
        Returns a mapping of all enabled notification setting providers for the enabled options.
        Note that this includes default settings for any notification types that are not set.
        """

        setting_options = self._get_layered_setting_options(**kwargs)
        setting_providers = self._get_layered_setting_providers(**kwargs)

        setting_option_and_providers: MutableMapping[
            Recipient,
            MutableMapping[
                Scope,
                MutableMapping[
                    NotificationSettingEnum,
                    MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum],
                ],
            ],
        ] = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
        for recipient, setting_option in setting_options.items():
            for scope, setting in setting_option.items():
                for type, option_value in setting.items():
                    if option_value == NotificationSettingsOptionEnum.NEVER:
                        continue

                    recipient_providers = setting_providers[recipient][scope][type]
                    for provider, provider_value in recipient_providers.items():
                        if provider_value == NotificationSettingsOptionEnum.NEVER:
                            continue

                        setting_option_and_providers[recipient][scope][type][
                            provider
                        ] = provider_value

        return setting_option_and_providers

    def get_settings_for_user_by_projects(
        self, user: Recipient
    ) -> MutableMapping[
        int,
        MutableMapping[
            NotificationSettingEnum,
            MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum],
        ],
    ]:
        """
        Returns a mapping of project IDs to enabled notification settings for the given user.
        """
        if not self.project_ids:
            raise Exception("Must specify project_ids")

        notification_settings = self.get_all_enabled_settings()
        user_settings = notification_settings[user]

        result = {}
        for scope, setting in user_settings.items():
            (scope_type, scope_identifier) = scope
            if scope_type != NotificationScopeEnum.PROJECT:
                continue

            if not isinstance(scope_identifier, int) or scope_identifier not in self.project_ids:
                continue

            result[scope_identifier] = setting

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

        enabled_settings = self.get_settings_for_user_by_projects(user)
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
    ) -> MutableMapping[
        RpcActor, MutableMapping[ExternalProviders, NotificationSettingsOptionEnum]
    ]:
        """
        Returns a mapping of recipients to the providers they should be notified on.
        Note that this returns the ExternalProviders int enum instead of the ExternalProviderEnum string.
        This helper is intended to be used with ParticipantMap, which expected int values.
        """
        if not self.type:
            raise Exception("Must specify type")

        enabled_settings = self.get_all_enabled_settings(type=self.type.value)
        user_to_providers: MutableMapping[
            RpcActor, MutableMapping[ExternalProviders, NotificationSettingsOptionEnum]
        ] = defaultdict(dict)
        for recipient, setting in enabled_settings.items():
            if not recipient_is_user(recipient):
                continue

            actor = RpcActor.from_object(recipient)
            for type_map in setting.values():
                for type, provider_map in type_map.items():
                    if type != self.type:
                        continue

                    user_to_providers[actor] = {
                        EXTERNAL_PROVIDERS_REVERSE[provider]: value
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

        setting_options = self._get_layered_setting_options(type=type.value)
        for _, setting in setting_options[recipient].items():
            value = setting[type]
            # Skip notifications that are off
            if value == NotificationSettingsOptionEnum.NEVER:
                continue
            return value

        return NotificationSettingsOptionEnum.NEVER

    def get_notification_provider_value_for_recipient_and_type(
        self, recipient: Recipient, type: NotificationSettingEnum, provider: ExternalProviderEnum
    ) -> NotificationSettingsOptionEnum:
        """
        Returns the notification setting value for the given recipient and type.

        Args:
            recipient: The recipient of the notification settings (user or team).
            type: The notification type to filter providers and recipients by.
        """
        if self.type and type != self.type:
            raise Exception("Type mismatch: the provided type differs from the controller type")

        setting_providers = self._get_layered_setting_providers(type=type.value)
        for _, recipient_mapping in setting_providers[recipient].items():
            type_mapping = recipient_mapping[type]
            value = type_mapping[provider]
            if value == NotificationSettingsOptionEnum.NEVER:
                continue

            return value

        return NotificationSettingsOptionEnum.NEVER

    def get_users_for_weekly_reports(self) -> list[int]:
        if not self.organization_id:
            raise Exception("Must specify organization_id")

        if self.type != NotificationSettingEnum.REPORTS:
            raise Exception(f"Type mismatch: the controller was initialized with type: {self.type}")

        enabled_settings = self.get_all_enabled_settings(type=NotificationSettingEnum.REPORTS.value)
        users = []
        for recipient, setting in enabled_settings.items():
            if not recipient_is_user(recipient):
                continue

            for type_map in setting.values():
                provider_map = type_map[NotificationSettingEnum.REPORTS]
                if (
                    ExternalProviderEnum.EMAIL in provider_map
                    and provider_map[ExternalProviderEnum.EMAIL]
                    == NotificationSettingsOptionEnum.ALWAYS
                ):
                    users.append(recipient.id)

        return users
