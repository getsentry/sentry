import logging

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_403_FORBIDDEN

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import (
    OrgAuthTokenAuthentication,
    SessionAuthentication,
    UserAuthTokenAuthentication,
)
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger: logging.Logger = logging.getLogger(__name__)


@control_silo_endpoint
class AuthValidateEndpoint(Endpoint):
    """Simple API endpoint to validate successful authentication"""

    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    owner = ApiOwner.SECURITY
    authentication_classes = (
        SessionAuthentication,
        UserAuthTokenAuthentication,
        OrgAuthTokenAuthentication,
    )
    permission_classes = ()

    enforce_rate_limit = True
    rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(limit=1250, window=1)}}

    def get(self, request: Request) -> Response:
        if request.auth or request.user.is_authenticated:
            return Response(status=HTTP_200_OK)
        return Response(status=HTTP_403_FORBIDDEN)
