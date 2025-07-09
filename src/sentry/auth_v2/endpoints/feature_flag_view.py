from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.decorators import control_silo_endpoint
from sentry.types.ratelimit import RateLimit, RateLimitCategory

from .base import AuthV2Endpoint


@control_silo_endpoint
class FeatureFlagView(AuthV2Endpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}
    enforce_rate_limit = True
    rate_limits = {
        "GET": {RateLimitCategory.IP: RateLimit(limit=30, window=60)}  # 30 per minute per IP
    }

    def get(self, request: Request) -> Response:
        """
        Check if the feature flag is set correctly on your machine.
        curl -X GET "https://sentry.io/api/0/auth-v2/feature-flag/" -H "X-Sentry-Auth-V2: ***"
        """
        return Response({"message": "Hello world"})
