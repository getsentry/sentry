from rest_framework.request import Request
from rest_framework.response import Response

# from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.issues.related.same_root_cause import same_root_cause_analysis
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationRelatedIssuesEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization: Organization) -> Response:
        # XXX: Add real feature flag
        # if not features.has("FOO", organization, actor=request.user):
        #     return Response({"status": "disabled"}, status=403)

        group_id = request.GET.get("groupId")
        if group_id is None:
            return Response({"status": "invalid"}, status=400)

        groups = same_root_cause_analysis(int(group_id))

        return Response({"groups": groups})
