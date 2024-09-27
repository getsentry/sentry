from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.issues.related.same_root_cause import same_root_cause_analysis
from sentry.issues.related.trace_connected import trace_connected_analysis
from sentry.models.group import Group
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class RequestSerializer(serializers.Serializer[None]):
    type = serializers.ChoiceField(["same_root_cause", "trace_connected"])
    event_id = serializers.CharField(required=False)
    project_id = serializers.IntegerField(required=False)


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
        serializer = RequestSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        _data = serializer.validated_data
        related_type = _data["type"]
        try:
            data, meta = (
                same_root_cause_analysis(group)
                if related_type == "same_root_cause"
                else trace_connected_analysis(
                    group, event_id=_data.get("event_id"), project_id=_data.get("project_id")
                )
            )
            return Response({"type": related_type, "data": data, "meta": meta})
        except AssertionError:
            return Response({}, status=400)
