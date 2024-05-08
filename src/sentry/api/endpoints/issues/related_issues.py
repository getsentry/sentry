from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.issues.related import RELATED_ISSUES_ALGORITHMS
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
    def get(self, request: Request, group: Group) -> Response:
        """
        Retrieve related issues for a Group
        ````````````````````````````````````
        Related issues can be based on the same root cause or trace connected.

        :pparam Request request: the request object
        :pparam Group group: the group object
        """
        # The type of related issues to retrieve. Can be either `same_root_cause` or `trace_connected`.
        related_type = request.query_params["type"]
        extra_args = {
            "event_id": request.query_params.get("event_id"),
            "project_id": request.query_params.get("project_id"),
        }
        data, meta = RELATED_ISSUES_ALGORITHMS[related_type](group, extra_args)
        return Response({"type": related_type, "data": data, "meta": meta})
