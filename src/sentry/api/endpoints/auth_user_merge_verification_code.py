from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.users.models import User
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
        if isinstance(request.user, AnonymousUser):
            return Response(
                status=401,
                data={"error": "You must be authenticated to use this endpoint"},
            )
        user = User.objects.get(id=request.user.id)
        if UserMergeVerificationCode.objects.filter(user_id=user.id).first() is not None:
            return Response(
                status=400,
                data={"error": "A verification code already exists for this user."},
            )
        code = UserMergeVerificationCode.objects.create(user_id=user.id)
        code.send_email(user, code.token)
        return Response("Successfully posted merge account verification code.")

    def put(self, request: Request) -> Response:
        if isinstance(request.user, AnonymousUser):
            return Response(
                status=401,
                data={"error": "You must be authenticated to use this endpoint"},
            )
        user = User.objects.get(id=request.user.id)

        try:
            code: UserMergeVerificationCode = UserMergeVerificationCode.objects.get(user_id=user.id)
        except UserMergeVerificationCode.DoesNotExist:
            return Response(
                status=404,
                data={"error": "No verification code exists for the requesting user."},
            )
        code.regenerate_token()
        code.send_email(user, code.token)
        return Response("Successfully regenerated merge account verification code.")
