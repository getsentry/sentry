from __future__ import annotations

from typing import Callable, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Tuple

from django.db import router, transaction
from django.db.models import Q, QuerySet

from sentry.api.serializers.base import Serializer
from sentry.api.serializers.models.notification_setting import NotificationSettingsSerializer
from sentry.models.notificationsetting import NotificationSetting
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.user import User
from sentry.notifications.helpers import get_scope_type
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationScopeType,
    NotificationSettingEnum,
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
from sentry.services.hybrid_cloud.user.service import user_service
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
        skip_provider_updates: bool = False,
        organization_id_for_team: Optional[int] = None,
    ) -> None:
        NotificationSetting.objects.update_settings(
            provider=external_provider,
            type=notification_type,
            value=setting_option,
            project=project_id,
            organization=organization_id,
            actor=actor,
            skip_provider_updates=skip_provider_updates,
            organization_id_for_team=organization_id_for_team,
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
                    skip_provider_updates=True,
                )
            # update the providers at the end
            NotificationSetting.objects.update_provider_settings(user_id, None)

    # TODO(snigdha): This can be removed in V2.
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
        # delete all options for team/user
        query_args = {"team_id": team_id, "user_id": user_id}
        NotificationSettingOption.objects.filter(**query_args).delete()
        NotificationSettingProvider.objects.filter(**query_args).delete()

    def remove_notification_settings_for_team(
        self, *, team_id: int, provider: ExternalProviders
    ) -> None:
        self.remove_notification_settings(team_id=team_id, user_id=None, provider=provider)

    def get_many(self, *, filter: NotificationSettingFilterArgs) -> List[RpcNotificationSetting]:
        return self._FQ.get_many(filter)

    def remove_notification_settings_for_organization(self, *, organization_id: int) -> None:
        assert organization_id, "organization_id must be a positive integer"
        NotificationSetting.objects.remove_for_organization(organization_id=organization_id)
        NotificationSettingOption.objects.filter(
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=organization_id,
        ).delete()
        NotificationSettingProvider.objects.filter(
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=organization_id,
        ).delete()

    def remove_notification_settings_for_project(self, *, project_id: int) -> None:
        NotificationSetting.objects.remove_for_project(project_id=project_id)
        NotificationSettingOption.objects.filter(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=project_id,
        ).delete()
        NotificationSettingProvider.objects.filter(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=project_id,
        ).delete()

    def serialize_many(
        self,
        *,
        filter: NotificationSettingFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
    ) -> List[OpaqueSerializedResponse]:
        return self._FQ.serialize_many(filter, as_user, auth_context)

    def get_subscriptions_for_projects(
        self,
        *,
        user_id: int,
        project_ids: List[int],
        type: NotificationSettingEnum,
    ) -> Mapping[int, Tuple[bool, bool, bool]]:
        """
        Returns a mapping of project_id to a tuple of (is_disabled, is_active, has_only_inactive_subscriptions)
        """
        user = user_service.get_user(user_id)
        if not user:
            return {}

        controller = NotificationController(
            recipients=[user],
            project_ids=project_ids,
            type=type,
        )
        return {
            project: (s.is_disabled, s.is_active, s.has_only_inactive_subscriptions)
            for project, s in controller.get_subscriptions_status_for_projects(
                user=user, project_ids=project_ids, type=type
            ).items()
        }

    def get_participants(
        self,
        *,
        recipients: List[RpcActor],
        type: NotificationSettingEnum,
        project_ids: Optional[List[int]] = None,
        organization_id: Optional[int] = None,
    ) -> MutableMapping[
        int, MutableMapping[int, str]
    ]:  # { actor_id : { provider_str: value_str } }
        controller = NotificationController(
            recipients=recipients,
            project_ids=project_ids,
            organization_id=organization_id,
            type=type,
        )
        participants = controller.get_participants()
        return {
            actor.id: {provider.value: value.value for provider, value in providers.items()}
            for actor, providers in participants.items()
        }

    def get_users_for_weekly_reports(
        self, *, organization_id: int, user_ids: List[int]
    ) -> List[int]:
        users = User.objects.filter(id__in=user_ids)
        controller = NotificationController(
            recipients=users,
            organization_id=organization_id,
            type=NotificationSettingEnum.REPORTS,
        )
        return controller.get_users_for_weekly_reports()

    def get_notification_recipients(
        self,
        *,
        recipients: Iterable[RpcActor],
        type: NotificationSettingEnum,
        project_ids: Optional[List[int]] = None,
        organization_id: Optional[int] = None,
        actor_type: Optional[ActorType] = None,
    ) -> Mapping[ExternalProviders, set[RpcActor]]:
        controller = NotificationController(
            recipients=recipients,
            organization_id=organization_id,
            project_ids=project_ids,
            type=type,
        )
        return controller.get_notification_recipients(type=type, actor_type=actor_type)

    class _NotificationSettingsQuery(
        FilterQueryDatabaseImpl[
            NotificationSetting, NotificationSettingFilterArgs, RpcNotificationSetting, None
        ],
    ):
        def apply_filters(
            self, query: QuerySet[NotificationSetting], filters: NotificationSettingFilterArgs
        ) -> QuerySet[NotificationSetting]:
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
            return query.all()

        def base_query(self, ids_only: bool = False) -> QuerySet[NotificationSetting]:
            return NotificationSetting.objects

        def filter_arg_validator(self) -> Callable[[NotificationSettingFilterArgs], Optional[str]]:
            return self._filter_has_any_key_validator("user_ids", "team_ids")

        def serialize_api(self, serializer_type: Optional[None]) -> Serializer:
            return NotificationSettingsSerializer()

        def serialize_rpc(
            self, notification_setting: NotificationSetting
        ) -> RpcNotificationSetting:
            return serialize_notification_setting(notification_setting)

    _FQ = _NotificationSettingsQuery()
