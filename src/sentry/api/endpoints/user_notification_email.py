from django.db import router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.models.options.user_option import UserOption
from sentry.models.useremail import UserEmail

INVALID_EMAIL_MSG = (
    "Invalid email value(s) provided. Email values must be verified emails for the given user."
)


@control_silo_endpoint
class UserNotificationEmailEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    def get(self, request: Request, user) -> Response:
        """
        Fetches the user's email notification settings.
        Returns a dictionary where the keys are the IDs of the projects
        and the values are the email addresses to be used for notifications for that project.
        """
        email_options = UserOption.objects.filter(
            key="mail:email", user=user, project_id__isnull=False
        ).select_related("user")

        return self.respond({str(option.project_id): option.value for option in email_options})

    def put(self, request: Request, user) -> Response:
        """
        Updates the user's email notification settings.
        The request data should be a dictionary where the keys are the IDs of the projects
        and the values are the email addresses to be used for notifications for that project.
        All email addresses must be verified and belong to the user.
        If any email address is not verified or does not belong to the user, a 400 error is returned.
        If the update is successful, a 204 status code is returned.
        """
        data = request.data

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
