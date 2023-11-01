# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from abc import abstractmethod
from typing import Iterable, List, Mapping, MutableMapping, Optional, Sequence, Set, Tuple

from sentry.notifications.types import (
    NotificationSettingEnum,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.auth.model import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import OpaqueSerializedResponse
from sentry.services.hybrid_cloud.notifications import RpcNotificationSetting
from sentry.services.hybrid_cloud.notifications.model import NotificationSettingFilterArgs
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode
from sentry.types.integrations import ExternalProviders


class NotificationsService(RpcService):
    key = "notifications"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.notifications.impl import (
            DatabaseBackedNotificationsService,
        )

        return DatabaseBackedNotificationsService()

    @rpc_method
    @abstractmethod
    def get_settings_for_recipient_by_parent(
        self,
        *,
        type: NotificationSettingTypes,
        parent_id: int,
        recipients: Sequence[RpcActor],
    ) -> List[RpcNotificationSetting]:
        pass

    @rpc_method
    @abstractmethod
    def get_settings_for_users(
        self,
        *,
        types: List[NotificationSettingTypes],
        users: List[RpcUser],
        value: NotificationSettingOptionValues,
    ) -> List[RpcNotificationSetting]:
        pass

    @rpc_method
    @abstractmethod
    def get_settings_for_user_by_projects(
        self, *, type: NotificationSettingTypes, user_id: int, parent_ids: List[int]
    ) -> List[RpcNotificationSetting]:
        pass

    @rpc_method
    @abstractmethod
    def update_settings(
        self,
        *,
        external_provider: ExternalProviders,
        notification_type: NotificationSettingTypes,
        setting_option: NotificationSettingOptionValues,
        actor: RpcActor,
        project_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        skip_provider_updates: bool = False,
        organization_id_for_team: Optional[int] = None,
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def bulk_update_settings(
        self,
        *,
        notification_type_to_value_map: Mapping[
            NotificationSettingTypes, NotificationSettingOptionValues
        ],
        external_provider: ExternalProviders,
        user_id: int,
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def uninstall_slack_settings(
        self,
        organization_id: int,
        project_ids: List[int],
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def remove_notification_settings_for_team(
        self, *, team_id: int, provider: ExternalProviders
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def get_many(self, *, filter: NotificationSettingFilterArgs) -> List[RpcNotificationSetting]:
        pass

    @rpc_method
    @abstractmethod
    def serialize_many(
        self,
        *,
        filter: NotificationSettingFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
    ) -> List[OpaqueSerializedResponse]:
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
    def get_subscriptions_for_projects(
        self,
        *,
        user_id: int,
        project_ids: List[int],
        type: NotificationSettingEnum,
    ) -> Mapping[int, Tuple[bool, bool, bool]]:
        pass

    @rpc_method
    @abstractmethod
    def get_participants(
        self,
        *,
        recipients: List[RpcActor],
        type: NotificationSettingEnum,
        project_ids: Optional[List[int]] = None,
        organization_id: Optional[int] = None,
    ) -> MutableMapping[int, MutableMapping[int, str]]:
        pass

    @rpc_method
    @abstractmethod
    def get_users_for_weekly_reports(
        self, *, organization_id: int, user_ids: List[int]
    ) -> List[int]:
        pass

    @rpc_method
    @abstractmethod
    def get_notification_recipients(
        self,
        *,
        recipients: Iterable[RpcActor],
        type: NotificationSettingEnum,
        project_ids: Optional[List[int]] = None,
        organization_id: Optional[int] = None,
        actor_type: Optional[ActorType] = None,
    ) -> Mapping[ExternalProviders, Set[RpcActor]]:
        pass


notifications_service = NotificationsService.create_delegation()
