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
        # if user is authenticated, as they must be to use the endpoint, then this is true
        assert user.id is not None
        try:
            # regenerate the code if it exists
            code: UserMergeVerificationCode = UserMergeVerificationCode.objects.get(user_id=user.id)
            code.regenerate_token()
        except UserMergeVerificationCode.DoesNotExist:
            code = UserMergeVerificationCode.objects.create(user_id=user.id)
        code.send_email(user.id, code.token)
        return Response("Successfully created or regenerated merge account verification code.")
