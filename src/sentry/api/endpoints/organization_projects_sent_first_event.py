from __future__ import absolute_import

from rest_framework.response import Response

from sentry.models import Project
from sentry.api.base import DocSection
from sentry.api.serializers import serialize
from sentry.api.bases.organization import OrganizationEndpoint


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
        :auth: required
        """
        queryset = Project.objects.filter(organization=organization, first_event__isnull=False)
        return Response(serialize({"sentFirstEvent": queryset.count() > 0}, request.user))
