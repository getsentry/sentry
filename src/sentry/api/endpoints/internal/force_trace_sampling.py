import logging

from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.auth.principal import acting_user, require_user
from sentry.users.models.useremail import UserEmail
from sentry.utils.force_trace_sampling import COOKIE_NAME, MAX_AGE_SECONDS, create_grant_token

logger = logging.getLogger(__name__)

EMPLOYEE_EMAIL_SUFFIX = "@sentry.io"


class ForceTraceSamplingPermission(BasePermission):
    """
    Allows Sentry employees, regardless of the organization they're viewing.

    `is_staff` alone doesn't guarantee someone is an employee yet, so this also requires a
    verified company email.
    """

    def has_permission(self, request: Request, view: object) -> bool:
        user = acting_user(request.user)
        if user is None or not user.is_staff:
            return False

        return UserEmail.objects.filter(
            user_id=user.id,
            is_verified=True,
            email__iendswith=EMPLOYEE_EMAIL_SUFFIX,
        ).exists()


@control_silo_endpoint
class InternalForceTraceSamplingEndpoint(Endpoint):
    owner = ApiOwner.WEB_FRONTEND_SDKS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (ForceTraceSamplingPermission,)

    def post(self, request: Request) -> Response:
        """Force-sample this browser's traces for a limited time."""
        if not options.get("tracing.force-sampling.enabled"):
            return Response({"detail": "Force trace sampling is disabled."}, status=404)

        user = require_user(request)
        token, expires_at_ms = create_grant_token(user.id)

        response = Response({"expiresAt": expires_at_ms})
        response.set_cookie(
            COOKIE_NAME,
            token,
            max_age=MAX_AGE_SECONDS,
            path=settings.SESSION_COOKIE_PATH,
            domain=settings.SESSION_COOKIE_DOMAIN,
            secure=(
                request.is_secure()
                if settings.SESSION_COOKIE_SECURE is None
                else settings.SESSION_COOKIE_SECURE
            ),
            httponly=True,
            samesite=settings.SESSION_COOKIE_SAMESITE,
        )
        logger.info("force_trace_sampling.enabled", extra={"user_id": user.id})
        return response

    def delete(self, request: Request) -> Response:
        """Stop force-sampling this browser's traces."""
        response = Response(status=204)
        response.delete_cookie(
            COOKIE_NAME,
            path=settings.SESSION_COOKIE_PATH,
            domain=settings.SESSION_COOKIE_DOMAIN,
        )
        return response
