from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.serializers import serialize
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.auth.superuser import is_active_superuser
from sentry.models import Project


class OrganizationHasProjectsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization):
        """
        Verify If A User Has Access to Projects In An Organization
        ``````````````````````````````````````````````````````````

        Returns true if there are any projects within the organization that
        the user has access to via team membership or superuser access

        :pparam string organization_slug: the slug of the organization
                                          to check
        :auth: required
        """
        if is_active_superuser(request):
            # retrieve all projects within the organization
            queryset = Project.objects.filter(organization=organization)
            return Response(serialize({"hasProjects": queryset.count() > 0}, request.user))
        else:
            return Response(
                serialize({"hasProjects": len(request.access.projects) > 0}, request.user)
            )
