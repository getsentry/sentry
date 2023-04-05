from __future__ import annotations

from typing import List, Optional, Sequence

from django.db.models import Q

from sentry.models import NotificationSetting, User
from sentry.models.actor import get_actor_id_for_user
from sentry.notifications.helpers import get_scope_type
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.notifications import NotificationsService, RpcNotificationSetting
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
            actor=actor,
            project=project_id,
            organization=organization_id,
        )

    def get_settings_for_users(
        self,
        *,
        types: List[NotificationSettingTypes],
        users: List[RpcUser],
        value: NotificationSettingOptionValues,
    ) -> List[RpcNotificationSetting]:
        settings = NotificationSetting.objects.filter(
            target__in=[u.actor_id for u in users],
            type__in=types,
            value=value.value,
            scope_type=NotificationScopeType.USER.value,
        )
        return [self.serialize_notification_setting(u) for u in settings]

    def get_settings_for_recipient_by_parent(
        self, *, type: NotificationSettingTypes, parent_id: int, recipients: Sequence[RpcActor]
    ) -> List[RpcNotificationSetting]:
        team_ids = [r.id for r in recipients if r.actor_type == ActorType.TEAM]
        user_ids = [r.id for r in recipients if r.actor_type == ActorType.USER]
        actor_ids: List[int] = [r.actor_id for r in recipients if r.actor_id is not None]

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
            type=type.value,
            target__in=actor_ids,
        )

        return [self.serialize_notification_setting(s) for s in notification_settings]

    def get_settings_for_user_by_projects(
        self, *, type: NotificationSettingTypes, user_id: int, parent_ids: List[int]
    ) -> List[RpcNotificationSetting]:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return []

        scope_type = get_scope_type(type)
        return [
            self.serialize_notification_setting(s)
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
                target_id=get_actor_id_for_user(user),
            )
        ]

    def remove_notification_settings(self, *, actor_id: int, provider: ExternalProviders) -> None:
        """
        Delete notification settings based on an actor_id
        There is no foreign key relationship so we have to manually cascade.
        """
        NotificationSetting.objects._filter(target_ids=[actor_id], provider=provider).delete()

    def close(self) -> None:
        pass
