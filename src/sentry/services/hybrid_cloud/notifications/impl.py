from __future__ import annotations

from typing import Callable, List, Mapping, Optional, Sequence

from django.db import router, transaction
from django.db.models import Q, QuerySet

from sentry.api.serializers.base import Serializer
from sentry.api.serializers.models.notification_setting import NotificationSettingsSerializer
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models import NotificationSetting, User
from sentry.notifications.helpers import get_scope_type
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.auth.model import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import (
    FilterQueryDatabaseImpl,
    OpaqueSerializedResponse,
)
from sentry.services.hybrid_cloud.notifications import NotificationsService, RpcNotificationSetting
from sentry.services.hybrid_cloud.notifications.model import NotificationSettingFilterArgs
from sentry.services.hybrid_cloud.notifications.serial import serialize_notification_setting
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.types.integrations import ExternalProviders


class DatabaseBackedNotificationsService(NotificationsService):
    def uninstall_slack_settings(self, organization_id: int, project_ids: List[int]) -> None:
        provider = ExternalProviders.SLACK
        users = User.objects.get_users_with_only_one_integration_for_provider(
            provider, organization_id
        )

        NotificationSetting.objects.remove_parent_settings_for_organization(
            organization_id, project_ids, provider
        )
        NotificationSetting.objects.disable_settings_for_users(provider, users)

    def update_settings(
        self,
        *,
        external_provider: ExternalProviders,
        notification_type: NotificationSettingTypes,
        setting_option: NotificationSettingOptionValues,
        actor: RpcActor,
        project_id: Optional[int] = None,
        organization_id: Optional[int] = None,
    ) -> None:
        NotificationSetting.objects.update_settings(
            provider=external_provider,
            type=notification_type,
            value=setting_option,
            project=project_id,
            organization=organization_id,
            actor=actor,
        )

    def bulk_update_settings(
        self,
        *,
        notification_type_to_value_map: Mapping[
            NotificationSettingTypes, NotificationSettingOptionValues
        ],
        external_provider: ExternalProviders,
        user_id: int,
    ) -> None:
        with transaction.atomic(router.db_for_write(NotificationSetting)):
            for notification_type, setting_option in notification_type_to_value_map.items():
                self.update_settings(
                    external_provider=external_provider,
                    actor=RpcActor(id=user_id, actor_type=ActorType.USER),
                    notification_type=notification_type,
                    setting_option=setting_option,
                )

    def get_settings_for_users(
        self,
        *,
        types: List[NotificationSettingTypes],
        users: List[RpcUser],
        value: NotificationSettingOptionValues,
    ) -> List[RpcNotificationSetting]:
        settings = NotificationSetting.objects.filter(
            user_id__in=[u.id for u in users],
            type__in=types,
            value=value.value,
            scope_type=NotificationScopeType.USER.value,
        )
        return [serialize_notification_setting(u) for u in settings]

    def get_settings_for_recipient_by_parent(
        self, *, type: NotificationSettingTypes, parent_id: int, recipients: Sequence[RpcActor]
    ) -> List[RpcNotificationSetting]:
        team_ids = [r.id for r in recipients if r.actor_type == ActorType.TEAM]
        user_ids = [r.id for r in recipients if r.actor_type == ActorType.USER]

        parent_specific_scope_type = get_scope_type(type)
        notification_settings = NotificationSetting.objects.filter(
            Q(
                scope_type=parent_specific_scope_type.value,
                scope_identifier=parent_id,
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
            type=type.value,
        )

        return [serialize_notification_setting(s) for s in notification_settings]

    def get_settings_for_user_by_projects(
        self, *, type: NotificationSettingTypes, user_id: int, parent_ids: List[int]
    ) -> List[RpcNotificationSetting]:
        try:
            User.objects.get(id=user_id)
        except User.DoesNotExist:
            return []

        scope_type = get_scope_type(type)
        return [
            serialize_notification_setting(s)
            for s in NotificationSetting.objects.filter(
                Q(
                    scope_type=scope_type.value,
                    scope_identifier__in=parent_ids,
                )
                | Q(
                    scope_type=NotificationScopeType.USER.value,
                    scope_identifier=user_id,
                ),
                type=type.value,
                user_id=user_id,
            )
        ]

    def remove_notification_settings(
        self, *, team_id: Optional[int], user_id: Optional[int], provider: ExternalProviders
    ) -> None:
        """
        Delete notification settings based on an actor_id
        There is no foreign key relationship so we have to manually cascade.
        """
        assert (team_id and not user_id) or (
            user_id and not team_id
        ), "Can only remove settings for team or user"
        team_ids = [team_id] if team_id else None
        user_ids = [user_id] if user_id else None
        NotificationSetting.objects._filter(
            team_ids=team_ids, user_ids=user_ids, provider=provider
        ).delete()

    def remove_notification_settings_for_team(
        self, *, team_id: int, provider: ExternalProviders
    ) -> None:
        self.remove_notification_settings(team_id=team_id, user_id=None, provider=provider)

    def remove_notification_settings_for_user(
        self, *, user_id: int, provider: ExternalProviders
    ) -> None:
        self.remove_notification_settings(team_id=None, user_id=user_id, provider=provider)

    def get_many(self, *, filter: NotificationSettingFilterArgs) -> List[RpcNotificationSetting]:
        return self._FQ.get_many(filter)

    def serialize_many(
        self,
        *,
        filter: NotificationSettingFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
        serializer: Optional[Serializer] = None,
    ) -> List[OpaqueSerializedResponse]:
        return self._FQ.serialize_many(filter, as_user, auth_context, serializer)

    class _NotificationSettingsQuery(
        FilterQueryDatabaseImpl[
            NotificationSetting, NotificationSettingFilterArgs, RpcNotificationSetting, None
        ],
    ):
        def apply_filters(
            self,
            query: BaseQuerySet,
            filters: NotificationSettingFilterArgs,
        ) -> List[User]:
            if "provider" in filters and filters["provider"] is not None:
                query = query.filter(provider=filters["provider"])
            if "type" in filters and filters["type"] is not None:
                query = query.filter(type=filters["type"].value)
            if "scope_type" in filters and filters["scope_type"] is not None:
                query = query.filter(scope_type=filters["scope_type"])
            if "scope_identifier" in filters and filters["scope_identifier"] is not None:
                query = query.filter(scope_identifier=filters["scope_identifier"])
            if "user_ids" in filters and len(filters["user_ids"]) > 0:
                query = query.filter(user_id__in=filters["user_ids"])
            if "team_ids" in filters and len(filters["team_ids"]) > 0:
                query = query.filter(team_id__in=filters["team_ids"])
            return list(query.all())

        def base_query(self, ids_only: bool = False) -> QuerySet:
            return NotificationSetting.objects

        def filter_arg_validator(self) -> Callable[[NotificationSettingFilterArgs], Optional[str]]:
            return self._filter_has_any_key_validator("user_ids", "team_ids")

        def serialize_api(self, serializer_type: Optional[None]) -> Serializer:
            return NotificationSettingsSerializer()

        def serialize_rpc(self, notification_setting: NotificationSetting) -> RpcUser:
            return serialize_notification_setting(notification_setting)

    _FQ = _NotificationSettingsQuery()
