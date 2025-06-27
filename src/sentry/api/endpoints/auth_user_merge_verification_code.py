from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.users.models.user_merge_verification_code import UserMergeVerificationCode


@control_silo_endpoint
class AuthUserMergeVerificationCodeEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SentryIsAuthenticated,)
    """
    Generate and update verification codes for the user account merge flow.
    """

    def post(self, request: Request) -> Response:
        user = request.user
        if isinstance(user, AnonymousUser):
            return Response(
                status=401,
                data={"error": "You must be authenticated to use this endpoint"},
            )

        UserMergeVerificationCode.objects.create(user_id=user.id)
        # TODO: send email
        return Response("Successfully posted merge account verification code.")

    def put(self, request: Request) -> Response:
        user = request.user
        if isinstance(user, AnonymousUser):
            return Response(
                status=401,
                data={"error": "You must be authenticated to use this endpoint"},
            )

        try:
            code: UserMergeVerificationCode = UserMergeVerificationCode.objects.get(user_id=user.id)
        except UserMergeVerificationCode.DoesNotExist:
            return Response(
                status=404,
                data={"error": "No verification code exists for the requesting user."},
            )
        code.regenerate_token()
        # TODO: send email
        return Response("Successfully regenerated merge account verification code.")
