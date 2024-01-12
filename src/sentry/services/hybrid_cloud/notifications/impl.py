from __future__ import annotations

from typing import List, Mapping, MutableMapping, Optional, Tuple

from django.db import router, transaction

from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.user import User
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.notifications import NotificationsService
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviderEnum, ExternalProviders


class DatabaseBackedNotificationsService(NotificationsService):
    def enable_all_settings_for_provider(
        self,
        *,
        external_provider: ExternalProviderEnum,
        user_id: Optional[int] = None,
        team_id: Optional[int] = None,
        types: Optional[List[NotificationSettingEnum]] = None,
    ) -> None:
        assert (team_id and not user_id) or (
            user_id and not team_id
        ), "Can only enable settings for team or user"

        kwargs: MutableMapping[str, str | int] = {}
        if user_id:
            kwargs["user_id"] = user_id
            kwargs["scope_type"] = NotificationScopeEnum.USER.value
            kwargs["scope_identifier"] = user_id
        elif team_id:
            kwargs["team_id"] = team_id
            kwargs["scope_type"] = NotificationScopeEnum.TEAM.value
            kwargs["scope_identifier"] = team_id

        with transaction.atomic(router.db_for_write(NotificationSettingProvider)):
            for type_enum in NotificationSettingEnum:
                # check the type if it's an input
                if types and type_enum not in types:
                    continue
                NotificationSettingProvider.objects.create_or_update(
                    **kwargs,
                    provider=external_provider.value,
                    type=type_enum.value,
                    values={
                        "value": NotificationSettingsOptionEnum.ALWAYS.value,
                    },
                )

    def update_notification_options(
        self,
        *,
        actor: RpcActor,
        type: NotificationSettingEnum,
        scope_type: NotificationScopeEnum,
        scope_identifier: int,
        value: NotificationSettingsOptionEnum,
    ):
        kwargs = {}
        if actor.actor_type == ActorType.USER:
            kwargs["user_id"] = actor.id
        else:
            kwargs["team_id"] = actor.id
        NotificationSettingOption.objects.create_or_update(
            type=type.value,
            scope_type=scope_type.value,
            scope_identifier=scope_identifier,
            values={"value": value.value},
            **kwargs,
        )

    def remove_notification_settings_for_provider_team(
        self, *, team_id: int, provider: ExternalProviders
    ) -> None:
        """
        This function removes provider settings if a team has been unlinked from a provider.
        """
        # skip if not a supported provider with settings
        if provider not in EXTERNAL_PROVIDERS:
            return
        NotificationSettingProvider.objects.filter(
            team_id=team_id, provider=EXTERNAL_PROVIDERS[provider]
        ).delete()

    def remove_notification_settings_for_organization(self, *, organization_id: int) -> None:
        assert organization_id, "organization_id must be a positive integer"
        NotificationSettingOption.objects.filter(
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=organization_id,
        ).delete()
        NotificationSettingProvider.objects.filter(
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=organization_id,
        ).delete()

    def remove_notification_settings_for_project(self, *, project_id: int) -> None:
        NotificationSettingOption.objects.filter(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=project_id,
        ).delete()
        NotificationSettingProvider.objects.filter(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=project_id,
        ).delete()

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
            # TODO(Steve): Simplify API to pass in one project at a time
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
        recipients: List[RpcActor],
        type: NotificationSettingEnum,
        organization_id: Optional[int] = None,
        project_ids: Optional[List[int]] = None,
        actor_type: Optional[ActorType] = None,
    ) -> Mapping[str, set[RpcActor]]:
        controller = NotificationController(
            recipients=recipients,
            organization_id=organization_id,
            project_ids=project_ids,
            type=type,
        )
        raw_output = controller.get_notification_recipients(type=type, actor_type=actor_type)
        return {str(provider.name): actors for provider, actors in raw_output.items()}
