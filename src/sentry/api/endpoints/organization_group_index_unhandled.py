from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventPermission, OrganizationEventsEndpointBase
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class OrganizationGroupIndexStatsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (OrganizationEventPermission,)
    enforce_rate_limit = True

    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(10, 1),
            RateLimitCategory.USER: RateLimit(10, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(10, 1),
        }
    }

    def get(self, request: Request, organization) -> Response:
        return
