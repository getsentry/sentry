from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.issues.related.same_root_cause import same_root_cause_analysis
from sentry.models.group import Group

# from sentry import features


@region_silo_endpoint
class GroupRelatedIssuesEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, group: Group) -> Response:
        # XXX: Add real feature flag
        # if not features.has("FOO", organization, actor=request.user):
        #     return Response({"status": "disabled"}, status=403)

        # XXX: This needs to be generic to support multiple types of related issues
        groups = same_root_cause_analysis(group)

        return Response({"groups": [group.id for group in groups]})
