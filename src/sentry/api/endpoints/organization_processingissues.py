from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize


@region_silo_endpoint
class OrganizationProcessingIssuesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization) -> Response:
        """
        For each Project in an Organization, list its processing issues. Can
        be passed `project` to filter down to specific projects.

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :qparam array[string] project: An optional list of project ids to filter
        to within the organization
        :auth: required

        """
        data = []
        for project in self.get_projects(request, organization):
            data.append(
                {
                    "hasIssues": False,
                    "numIssues": 0,
                    "lastSeen": None,
                    "resolveableIssues": 0,
                    "hasMoreResolveableIssues": False,
                    "issuesProcessing": 0,
                    "project": project.slug,
                    "issues": [],
                }
            )
        return Response(serialize(data, request.user))
