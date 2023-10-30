from typing import Any, Mapping

from django.db import router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models import UserNotificationsSerializer
from sentry.models.notificationsetting import NotificationSetting
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.options.user_option import UserOption
from sentry.models.useremail import UserEmail
from sentry.notifications.types import (
    FineTuningAPIKey,
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.notifications.utils.legacy_mappings import (
    get_option_value_from_int,
    get_type_from_fine_tuning_key,
)
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.integrations import ExternalProviders

INVALID_EMAIL_MSG = (
    "Invalid email value(s) provided. Email values must be verified emails for the given user."
)
INVALID_USER_MSG = (
    "User does not belong to at least one of the requested organizations (org_id: %s)."
)


@control_silo_endpoint
class UserNotificationFineTuningEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, user, notification_type) -> Response:
        try:
            notification_type = FineTuningAPIKey(notification_type)
        except ValueError:
            return Response(
                {"detail": "Unknown notification type: %s." % notification_type},
                status=status.HTTP_404_NOT_FOUND,
            )

        notifications = UserNotificationsSerializer()
        return Response(
            serialize(
                user,
                request.user,
                notifications,
                notification_type=notification_type,
            )
        )

    def put(self, request: Request, user, notification_type) -> Response:
        """
        Update user notification options
        ````````````````````````````````

        Updates user's notification options on a per project or organization
        basis. Expected payload is a map/dict whose key is a project or org id
        and value varies depending on `notification_type`.

        For `alerts`, `workflow`, `email` it expects a key of projectId
        For `deploy` and `reports` it expects a key of organizationId

        For `alerts`, `workflow`, `deploy`, it expects a value of:
            - "-1" = for "default" value (i.e. delete the option)
            - "0"  = disabled
            - "1"  = enabled
        For `reports` it is only a boolean.
        For `email` it is a verified email (string).

        :auth required:
        :pparam string notification_type:  One of:  alerts, workflow, reports, deploy, email
        :param map: Expects a map of id -> value (enabled or email)
        """
        try:
            notification_type = FineTuningAPIKey(notification_type)
        except ValueError:
            return Response(
                {"detail": "Unknown notification type: %s." % notification_type},
                status=status.HTTP_404_NOT_FOUND,
            )

        if notification_type == FineTuningAPIKey.REPORTS:
            return self._handle_put_reports(user, request.data)

        # Validate that all of the IDs are integers.
        try:
            for k in request.data.keys():
                int(k)
        except ValueError:
            return Response(
                {"detail": "Invalid id value provided. Id values should be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Make sure that the IDs we are going to update are a subset of the
        # user's list of organizations or projects.

        if notification_type == FineTuningAPIKey.EMAIL:
            return self._handle_put_emails(user, request.data)

        return self._handle_put_notification_settings(user, notification_type, request.data)

    @staticmethod
    def _handle_put_reports(user, data):
        user_option, _ = UserOption.objects.get_or_create(
            user=user,
            key="reports:disabled-organizations",
        )

        value = set(user_option.value or [])

        # The set of IDs of the organizations of which the user is a member.
        org_ids = {o.id for o in user_service.get_organizations(user_id=user.id, only_visible=True)}
        for org_id, enabled in data.items():
            org_id = int(org_id)
            # We want "0" to be falsey
            enabled = int(enabled)

            # make sure user is in org
            if org_id not in org_ids:
                return Response(
                    {"detail": INVALID_USER_MSG % org_id}, status=status.HTTP_403_FORBIDDEN
                )

            # The list contains organization IDs that should have reports
            # DISABLED. If enabled, we need to check if org_id exists in list
            # (because by default they will have reports enabled.)
            if enabled and org_id in value:
                value.remove(org_id)
            elif not enabled:
                value.add(org_id)

            NotificationSettingOption.objects.create_or_update(
                scope_type=NotificationScopeEnum.ORGANIZATION.value,
                scope_identifier=org_id,
                user_id=user.id,
                type=NotificationSettingEnum.REPORTS.value,
                values={
                    "value": NotificationSettingsOptionEnum.ALWAYS.value
                    if enabled
                    else NotificationSettingsOptionEnum.NEVER.value,
                },
            )

        user_option.update(value=list(value))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _handle_put_emails(user, data):
        # Make sure target emails exist and are verified
        emails_to_check = set(data.values())
        emails = UserEmail.objects.filter(user=user, email__in=emails_to_check, is_verified=True)

        # TODO(mgaeta): Is there a better way to check this?
        if len(emails) != len(emails_to_check):
            return Response({"detail": INVALID_EMAIL_MSG}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic(using=router.db_for_write(UserOption)):
            for id, value in data.items():
                user_option, CREATED = UserOption.objects.get_or_create(
                    user=user,
                    key="mail:email",
                    project_id=int(id),
                )
                user_option.update(value=str(value))

        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _handle_put_notification_settings(
        user, notification_type: FineTuningAPIKey, data: Mapping[str, Any]
    ):
        with transaction.atomic(using=router.db_for_write(NotificationSetting)):
            for setting_obj_id_str, value_str in data.items():
                setting_obj_id_int = int(setting_obj_id_str)

                # This partitioning always does the same thing because notification_type stays constant.
                project_option, organization_option = (
                    (None, setting_obj_id_int)
                    if notification_type == FineTuningAPIKey.DEPLOY
                    else (setting_obj_id_int, None)
                )

                type = get_type_from_fine_tuning_key(notification_type)
                value_int = int(value_str)
                NotificationSetting.objects.update_settings(
                    ExternalProviders.EMAIL,
                    type,
                    get_option_value_from_int(type, value_int),
                    user_id=user.id,
                    project=project_option,
                    organization=organization_option,
                )

        return Response(status=status.HTTP_204_NO_CONTENT)
