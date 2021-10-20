import logging

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.validators import AllowedEmailField
from sentry.models import UserEmail

logger = logging.getLogger("sentry.accounts")


class InvalidEmailResponse(Response):
    def __init__(self):
        super().__init__(
            {"detail": "Invalid email", "email": "Invalid email"},
            status=status.HTTP_400_BAD_REQUEST,
        )


class InvalidEmailError(Exception):
    pass


class DuplicateEmailError(Exception):
    pass


class EmailSerializer(serializers.Serializer):
    email = AllowedEmailField(required=True)


class UserEmailsConfirmEndpoint(UserEndpoint):
    def post(self, request, user):
        """
        Sends a confirmation email to user
        ``````````````````````````````````

        :auth required:
        """

        from sentry.app import ratelimiter

        if ratelimiter.is_limited(
            f"auth:confirm-email:{user.id}",
            limit=10,
            window=60,  # 10 per minute should be enough for anyone
        ):
            return self.respond(
                {
                    "detail": "You have made too many email confirmation requests. Please try again later."
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = EmailSerializer(data=request.data)

        if not serializer.is_valid():
            return InvalidEmailResponse()

        # If email is specified then try to only send one confirmation email
        try:
            email_to_send = UserEmail.objects.get(
                user=user, email__iexact=serializer.validated_data["email"].strip()
            )
        except UserEmail.DoesNotExist:
            return InvalidEmailResponse()
        else:
            if email_to_send.is_verified:
                return self.respond(
                    {"detail": "Email is already verified"}, status=status.HTTP_400_BAD_REQUEST
                )

            user.send_confirm_email_singular(email_to_send)

            logger.info(
                "user.email.start_confirm",
                extra={
                    "user_id": user.id,
                    "ip_address": request.META["REMOTE_ADDR"],
                    "email": email_to_send,
                },
            )
            return self.respond(status=status.HTTP_204_NO_CONTENT)
