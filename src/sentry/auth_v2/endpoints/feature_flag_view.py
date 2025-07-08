from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import ApiOwner, ApiPublishStatus, RateLimit, RateLimitCategory

from .base import AuthV2Endpoint


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
