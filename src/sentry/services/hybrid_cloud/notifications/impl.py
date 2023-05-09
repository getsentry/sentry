from __future__ import annotations

from typing import List, Mapping, Optional, Sequence, Union

from django.db import transaction
from django.db.models import Q

from sentry.models import NotificationSetting, Team, User
from sentry.notifications.helpers import get_scope_type
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.notifications import NotificationsService, RpcNotificationSetting
from sentry.services.hybrid_cloud.notifications.serial import serialize_notification_setting
from sentry.services.hybrid_cloud.organization import RpcTeam
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
        team: Optional[Union[RpcTeam, Team]] = None,
        user: Optional[Union[RpcUser, User]] = None,
        project_id: Optional[int] = None,
        organization_id: Optional[int] = None,
    ) -> None:
        NotificationSetting.objects.update_settings(
            provider=external_provider,
            type=notification_type,
            value=setting_option,
            team=team,
            user=user,
            actor=actor,
            project=project_id,
            organization=organization_id,
        )

    def bulk_update_settings(
        self,
        *,
        notification_type_to_value_map: Mapping[
            NotificationSettingTypes, NotificationSettingOptionValues
        ],
        external_provider: ExternalProviders,
        actor: RpcActor,
        team: Optional[Union[RpcTeam, Team]] = None,
        user: Optional[Union[RpcUser, User]] = None,
    ) -> None:
        with transaction.atomic():
            for notification_type, setting_option in notification_type_to_value_map.items():
                self.update_settings(
                    external_provider=external_provider,
                    actor=actor,
                    team=team,
                    user=user,
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
        # TODO(actorid) Adapt this to use Actor lookups.
        settings = NotificationSetting.objects.filter(
            target_id__in=[u.actor_id for u in users],
            type__in=types,
            value=value.value,
            scope_type=NotificationScopeType.USER.value,
        )
        return [serialize_notification_setting(u) for u in settings]

    def get_settings_for_recipient_by_parent(
        self,
        *,
        type: NotificationSettingTypes,
        parent_id: int,
        recipients: Sequence[Team | RpcTeam | User | RpcUser],
    ) -> List[RpcNotificationSetting]:
        team_ids = [r.id for r in recipients if isinstance(r, (Team, RpcTeam))]
        user_ids = [r.id for r in recipients if isinstance(r, (User, RpcUser))]
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
            target_id__in=actor_ids,
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
        team_ids = [team_id] if team_id else None
        user_ids = [user_id] if user_id else None
        NotificationSetting.objects._filter(
            team_ids=team_ids, user_ids=user_ids, provider=provider
        ).delete()

    def close(self) -> None:
        pass
