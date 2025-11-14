from typing import int
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.group_index import get_first_last_release
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.group import Group
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class GroupFirstLastReleaseEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=5, window=1),
                RateLimitCategory.USER: RateLimit(limit=5, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=1),
            }
        }
    )

    def get(self, request: Request, group: Group) -> Response:
        """
        Get the first and last release for a group, within the environments provided.
        If no environments are provided, the data returned will be across all environments.

        This data used to be returned by default in group_details.py, but now that we
        can collapse it, we're providing this endpoint to fetch the data separately.
        """
        environments = get_environments(request, group.project.organization)
        environment_names = [env.name for env in environments]

        first_release, last_release = get_first_last_release(
            request, group, environment_names=environment_names
        )
        data = {
            "id": str(group.id),
            "firstRelease": first_release,
            "lastRelease": last_release,
        }
        return Response(data)
