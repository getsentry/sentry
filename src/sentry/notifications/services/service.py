# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from abc import abstractmethod
from collections.abc import Mapping, MutableMapping

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders
from sentry.notifications.services.model import RpcSubscriptionStatus
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.silo.base import SiloMode
from sentry.types.actor import Actor, ActorType


class NotificationsService(RpcService):
    key = "notifications"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.notifications.services.impl import DatabaseBackedNotificationsService

        return DatabaseBackedNotificationsService()

    @rpc_method
    @abstractmethod
    def enable_all_settings_for_provider(
        self,
        *,
        external_provider: ExternalProviderEnum,
        user_id: int | None = None,
        team_id: int | None = None,
        types: list[NotificationSettingEnum] | None = None,
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def update_notification_options(
        self,
        *,
        actor: Actor,
        type: NotificationSettingEnum,
        scope_type: NotificationScopeEnum,
        scope_identifier: int,
        value: NotificationSettingsOptionEnum,
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def remove_notification_settings_for_provider_team(
        self, *, team_id: int, provider: ExternalProviders
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def remove_notification_settings_for_organization(self, *, organization_id: int) -> None:
        pass

    @rpc_method
    @abstractmethod
    def remove_notification_settings_for_project(self, *, project_id: int) -> None:
        pass

    @rpc_method
    @abstractmethod
    def subscriptions_for_projects(
        self,
        *,
        user_id: int,
        project_ids: list[int],
        type: NotificationSettingEnum,
    ) -> Mapping[int, RpcSubscriptionStatus]:
        """
        Returns a mapping of project_id to the subscription status for the provided user_id
        """
        pass

    @rpc_method
    @abstractmethod
    def get_participants(
        self,
        *,
        recipients: list[Actor],
        type: NotificationSettingEnum,
        project_ids: list[int] | None = None,
        organization_id: int | None = None,
    ) -> MutableMapping[int, MutableMapping[int, str]]:
        pass

    @rpc_method
    @abstractmethod
    def get_users_for_weekly_reports(
        self, *, organization_id: int, user_ids: list[int]
    ) -> list[int]:
        pass

    @rpc_method
    @abstractmethod
    def get_notification_recipients(
        self,
        *,
        recipients: list[Actor],
        type: NotificationSettingEnum,
        organization_id: int | None = None,
        project_ids: list[int] | None = None,
        actor_type: ActorType | None = None,
    ) -> Mapping[str, set[Actor]]:
        pass


notifications_service = NotificationsService.create_delegation()
