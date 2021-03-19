from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models import UserNotificationsSerializer
from sentry.models import (
    NotificationSetting,
    Project,
    UserOption,
    UserEmail,
)
from sentry.models.integration import ExternalProviders
from sentry.notifications.legacy_mappings import (
    get_option_value_from_int,
    get_type_from_fine_tuning_key,
)
from sentry.notifications.types import FineTuningAPIKey


INVALID_EMAIL_MSG = (
    "Invalid email value(s) provided. Email values must be verified emails for the given user."
)
INVALID_USER_MSG = (
    "User does not belong to at least one of the requested organizations (org_id: %s)."
)


class UserNotificationFineTuningEndpoint(UserEndpoint):
    def get(self, request, user, notification_type):
        try:
            notification_type = FineTuningAPIKey(notification_type)
        except ValueError:
            return Response(
                {"detail": "Unknown notification type: %s." % notification_type},
                status=status.HTTP_404_NOT_FOUND,
            )

        notifications = UserNotificationsSerializer()
        serialized = serialize(
            user,
            request.user,
            notifications,
            notification_type=notification_type,
        )
        return Response(serialized)

    def put(self, request, user, notification_type):
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
            ids_to_update = {int(i) for i in request.data.keys()}
        except ValueError:
            return Response(
                {"detail": "Invalid id value provided. Id values should be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Make sure that the IDs we are going to update are a subset of the
        # user's list of organizations or projects.
        parents = (
            user.get_orgs() if notification_type == FineTuningAPIKey.DEPLOY else user.get_projects()
        )
        parent_ids = {parent.id for parent in parents}
        if not ids_to_update.issubset(parent_ids):
            bad_ids = ids_to_update - parent_ids
            return Response(
                {
                    "detail": "At least one of the requested projects is not \
                    available to this user, because the user does not belong \
                    to the necessary teams. (ids of unavailable projects: %s)"
                    % bad_ids
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if notification_type == FineTuningAPIKey.EMAIL:
            return self._handle_put_emails(user, request.data)

        return self._handle_put_notification_settings(
            user, notification_type, parents, request.data
        )

    @staticmethod
    def _handle_put_reports(user, data):
        user_option, _ = UserOption.objects.get_or_create(
            user=user,
            key="reports:disabled-organizations",
        )

        value = set(user_option.value or [])

        # The set of IDs of the organizations of which the user is a member.
        org_ids = {organization.id for organization in user.get_orgs()}
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

        project_ids = [int(id) for id in data.keys()]
        projects_map = {
            int(project.id): project for project in Project.objects.filter(id__in=project_ids)
        }

        with transaction.atomic():
            for id, value in data.items():
                user_option, CREATED = UserOption.objects.get_or_create(
                    user=user,
                    key="mail:email",
                    project=projects_map[int(id)],
                )
                user_option.update(value=str(value))

        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _handle_put_notification_settings(user, notification_type: FineTuningAPIKey, parents, data):
        with transaction.atomic():
            for parent in parents:
                # We fetched every available parent but only care about the ones in `request.data`.
                if str(parent.id) not in data:
                    continue

                # This partitioning always does the same thing because notification_type stays constant.
                project_option, organization_option = (
                    (None, parent)
                    if notification_type == FineTuningAPIKey.DEPLOY
                    else (parent, None)
                )

                type = get_type_from_fine_tuning_key(notification_type)
                value = int(data[str(parent.id)])
                NotificationSetting.objects.update_settings(
                    ExternalProviders.EMAIL,
                    type,
                    get_option_value_from_int(type, value),
                    user=user,
                    project=project_option,
                    organization=organization_option,
                )

        return Response(status=status.HTTP_204_NO_CONTENT)
