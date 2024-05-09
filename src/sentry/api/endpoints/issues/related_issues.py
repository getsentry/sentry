from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.issues.related import find_related_issues  # To be deprecated
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
        related_type = request.query_params.get("type")
        related_issues: list[dict[str, str | list[int] | dict[str, str]]] = []

        if related_type in RELATED_ISSUES_ALGORITHMS:
            data, meta = RELATED_ISSUES_ALGORITHMS[related_type](group)
            return Response({"type": related_type, "data": data, "meta": meta})
        else:
            # XXX: We will be deprecating this approach soon
            related_issues = find_related_issues(group)
            return Response({"data": [related_set for related_set in related_issues]})
