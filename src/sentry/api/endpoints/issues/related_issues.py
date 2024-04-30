from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.issues.related import find_related_issues
from sentry.models.group import Group
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class RelatedIssuesEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=15, window=5),
            RateLimitCategory.USER: RateLimit(limit=15, window=5),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=15, window=1),
        }
    }

    # We get a Group object since the endpoint is /issues/{issue_id}/related-issues
    def get(self, _: Request, group: Group) -> Response:
        """
        Retrieve related issues for an Issue
        ````````````````````````````````````
        Related issues can be based on the same root cause or trace connected.

        :pparam string group_id: the ID of the issue
        """
        related_issues = find_related_issues(group)
        return Response({"data": [related_set for related_set in related_issues]})
