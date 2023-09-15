from __future__ import annotations

from collections import defaultdict
from typing import Iterable, Mapping, MutableMapping, Tuple, Union

from django.db.models import Q

from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.team import Team
from sentry.notifications.helpers import (
    get_provider_defaults,
    get_type_defaults,
    recipient_is_team,
    recipient_is_user,
)
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.types.integrations import ExternalProviderEnum

Recipient = Union[RpcActor, Team, RpcUser]
Scope = Tuple[NotificationScopeEnum, Union[int, Recipient]]


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
        # TODO(snigdha): Do we want to support querying without recipients?
        self.recipients = recipients
        self.project_ids = project_ids
        self.organization_id = organization_id
        self.type = type
        self.provider = provider

        query = self._get_query()
        type_filter = Q(type=self.type.value) if self.type else Q()
        provider_filter = Q(provider=self.provider.value) if self.provider else Q()
        self._setting_options = NotificationSettingOption.objects.filter(query & type_filter)
        self._setting_providers = NotificationSettingProvider.objects.filter(
            query & type_filter & provider_filter
        )

    def get_all_setting_options(self):
        return self._setting_options

    def get_all_setting_providers(self):
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

    def get_scope_for_layering(
        self, recipient: RpcActor | Team | RpcUser
    ) -> Tuple[NotificationScopeEnum, Iterable[int | RpcActor | Team | RpcUser]]:
        if self.project_ids:
            return (NotificationScopeEnum.PROJECT, self.project_ids)
        if self.organization_id is not None:
            return (NotificationScopeEnum.ORGANIZATION, [self.organization_id])
        if recipient_is_user(recipient):
            return (NotificationScopeEnum.USER, [recipient])
        if recipient_is_team(recipient):
            return (NotificationScopeEnum.TEAM, [recipient])

        raise ValueError(f"Recipient is of unsupported type: {recipient}")

    def get_layered_setting_options(
        self,
        setting_type: NotificationSettingEnum | None = None,
        additional_filters: Q | None = None,
    ) -> MutableMapping[
        Recipient,
        MutableMapping[
            Scope, MutableMapping[NotificationSettingEnum, NotificationSettingsOptionEnum]
        ],
    ]:
        """
        Returns a mapping of the most specific notification setting options for the given recipients and scopes.
        Note that this includes default settings for any notification types that are not set.

        Args:
            setting_type: If specified, only return settings of this type.
            additional_filters: Additional filters to apply to the query.
        """
        if not additional_filters:
            additional_filters = Q()

        if setting_type:
            additional_filters &= Q(type=setting_type.value)

        settings = self.get_all_setting_options().filter(additional_filters)
        project_settings = settings.filter(scope_type=NotificationScopeEnum.PROJECT.value)
        org_settings = settings.filter(scope_type=NotificationScopeEnum.ORGANIZATION.value)
        user_settings = settings.filter(scope_type=NotificationScopeEnum.USER.value)
        scoped_settings = [project_settings, org_settings, user_settings]

        defaults = get_type_defaults()
        layered_setting_options: MutableMapping[
            Recipient,
            MutableMapping[
                Scope, MutableMapping[NotificationSettingEnum, NotificationSettingsOptionEnum]
            ],
        ] = defaultdict(lambda: defaultdict(dict))
        for recipient in self.recipients:
            (scope_type, scope_items) = self.get_scope_for_layering(recipient)
            user_or_team_filter = Q(user_id=recipient.id) | Q(team_id=recipient.id)
            for item in scope_items:
                scope: Scope = (scope_type, item)
                for type in NotificationSettingEnum:
                    most_specific_setting = None
                    for setting in scoped_settings:
                        s = setting.filter(user_or_team_filter, type=type.value)
                        if s.exists():
                            most_specific_setting = NotificationSettingsOptionEnum(s.first().value)
                            break

                    if most_specific_setting is None and type in defaults:
                        most_specific_setting = defaults[type]

                    if most_specific_setting is None:
                        continue

                    layered_setting_options[recipient][scope][type] = most_specific_setting

        return layered_setting_options

    def get_layered_setting_providers(
        self,
        setting_type: NotificationSettingEnum | None = None,
        additional_filters: Q | None = None,
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
        Returns a mapping of the most specific notification setting providers for the given recipients and scopes.
        Note that this includes default settings for any notification types that are not set.

        Args:
            setting_type: If specified, only return settings of this type.
            additional_filters: Additional filters to apply to the query.
        """
        if not additional_filters:
            additional_filters = Q()

        if setting_type:
            additional_filters &= Q(type=setting_type.value)

        settings = self.get_all_setting_providers().filter(additional_filters)
        project_settings = settings.filter(scope_type=NotificationScopeEnum.PROJECT.value)
        org_settings = settings.filter(scope_type=NotificationScopeEnum.ORGANIZATION.value)
        user_settings = settings.filter(scope_type=NotificationScopeEnum.USER.value)
        scoped_settings = [project_settings, org_settings, user_settings]

        defaults = get_provider_defaults()
        layered_setting_providers: MutableMapping[
            Recipient,
            MutableMapping[
                Scope,
                MutableMapping[
                    NotificationSettingEnum,
                    MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum],
                ],
            ],
        ] = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
        for recipient in self.recipients:
            (scope_type, scope_items) = self.get_scope_for_layering(recipient)
            user_or_team_filter = Q(user_id=recipient.id) | Q(team_id=recipient.id)
            for item in scope_items:
                scope = (scope_type, item)
                for type in NotificationSettingEnum:
                    if setting_type and type != setting_type:
                        continue
                    for provider in ExternalProviderEnum:
                        most_specific_setting = None
                        for setting in scoped_settings:
                            s = setting.filter(user_or_team_filter, type=type.value)
                            if s.exists():
                                most_specific_setting = NotificationSettingsOptionEnum(
                                    s.first().value
                                )
                                break

                        if most_specific_setting is None:
                            most_specific_setting = (
                                NotificationSettingsOptionEnum.ALWAYS
                                if provider in defaults
                                else NotificationSettingsOptionEnum.NEVER
                            )

                        layered_setting_providers[recipient][scope][type].update(
                            {provider: most_specific_setting}
                        )

        return layered_setting_providers

    def get_notification_recipients(
        self,
        type: NotificationSettingEnum,
    ) -> Mapping[ExternalProviderEnum, set[Recipient]]:
        """
        Returns the recipients that should be notified for each provider,
        filtered by the given notification type.

        Args:
            type: The notification type to filter providers and recipients by.
        """
        setting_off = ~Q(value=NotificationSettingsOptionEnum.NEVER.value)
        setting_options = self.get_layered_setting_options(
            setting_type=type, additional_filters=setting_off
        )
        setting_providers = self.get_layered_setting_providers(
            setting_type=type, additional_filters=setting_off
        )

        recipients: Mapping[ExternalProviderEnum, set[Recipient]] = defaultdict(set)
        for recipient, setting_option in setting_options.items():
            for scope, setting in setting_option.items():
                for type, value in setting.items():
                    # Skip notifications that are off by default
                    if value == NotificationSettingsOptionEnum.NEVER:
                        continue

                    recipient_providers = setting_providers[recipient][scope][type]
                    for provider, value in recipient_providers.items():
                        # skip providers that are off by default
                        if value == NotificationSettingsOptionEnum.NEVER:
                            continue
                        recipients[provider].add(recipient)
        return recipients

    def get_all_enabled_settings(
        self,
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

        setting_options = self.get_layered_setting_options()
        setting_providers = self.get_layered_setting_providers()

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

    def get_settings_options_for_user_by_projects(
        self, user: Recipient
    ) -> MutableMapping[
        int,
        MutableMapping[
            NotificationSettingEnum,
            MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum],
        ],
    ]:
        """
        Returns a mapping of project IDs to notification settings for the given user.
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
        self, user: Recipient
    ) -> Mapping[int, Tuple[bool, bool]]:
        """
        Returns whether the user is subscribed for each project, and the subscription object if it exists.
        {project_id -> (is_disabled, is_active, subscription object)}
        """
        if not self.type:
            raise Exception("Must specify type")

        enabled_settings = self.get_settings_options_for_user_by_projects(user)
        subscription_status_for_projects = {}
        for project, type_setting in enabled_settings.items():
            for type, setting in type_setting.items():
                if type != self.type:
                    continue

                subscription_status_for_projects[project] = (
                    setting == {},
                    any(
                        value == NotificationSettingsOptionEnum.ALWAYS for value in setting.values()
                    ),
                )

        return subscription_status_for_projects

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

        settings = self.get_all_setting_providers()
        for setting in settings:
            if setting.provider != provider.value:
                continue

            if setting.value == NotificationSettingsOptionEnum.ALWAYS.value:
                return True

        return False
