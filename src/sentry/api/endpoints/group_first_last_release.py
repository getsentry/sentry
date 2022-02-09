from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases import GroupEndpoint
from sentry.api.helpers.group_index import get_first_last_release
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class GroupFirstLastReleaseEndpoint(GroupEndpoint, EnvironmentMixin):
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(5, 1),
            RateLimitCategory.USER: RateLimit(5, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(5, 1),
        }
    }

    def get(self, request: Request, group) -> Response:
        """Get the first and last release for a group.

        This data used to be returned by default in group_details.py, but now that we
        can collapse it, we're providing this endpoint to fetch the data separately.
        """
        first_release, last_release = get_first_last_release(request, group)
        data = {
            "id": str(group.id),
            "firstRelease": first_release,
            "lastRelease": last_release,
        }
        return Response(data)
