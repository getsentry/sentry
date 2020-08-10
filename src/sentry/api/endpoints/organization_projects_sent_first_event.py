from __future__ import absolute_import

from rest_framework.response import Response

from sentry.models import Project
from sentry.api.base import DocSection
from sentry.api.serializers import serialize
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.utils.compat import map


class OrganizationProjectsSentFirstEventEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization):
        """
        Verify If Any Project Within An Organization Has Received a First Event
        ```````````````````````````````````````````````````````````````````````

        Returns true if any projects within the organization have received
        a first event, false otherwise.

        :pparam string organization_slug: the slug of the organization
                                          containing the projects to check
                                          for a first event from.
        :qparam boolean is_member:        An optional boolean to choose to filter on
                                          projects which the user is a member of.
        :qparam array[string] project:    An optional list of project ids to filter
        :auth: required
        """
        is_member = request.GET.get("is_member")
        project_ids = set(map(int, request.GET.getlist("project")))
        queryset = Project.objects.filter(organization=organization, first_event__isnull=False)
        if is_member:
            queryset = queryset.filter(teams__organizationmember__user=request.user)
        if project_ids:
            queryset = queryset.filter(id__in=project_ids)

        return Response(serialize({"sentFirstEvent": queryset.exists()}, request.user))
