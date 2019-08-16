from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.processing_issues import get_processing_issues
from sentry.api.serializers import serialize


class OrganizationProcessingIssuesEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        For each Project in an Organization, list its processing issues. Can
        be passed `project` to filter down to specific projects.

        :pparam string organization_slug: the slug of the organization.
        :qparam array[string] project: An optional list of project ids to filter
        to within the organization
        :auth: required

        """
        data = get_processing_issues(
            request.user,
            self.get_projects(request, organization),
            request.GET.get("detailed") == "1",
        )
        return Response(serialize(data, request.user))
