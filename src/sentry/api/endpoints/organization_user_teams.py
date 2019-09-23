from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.base import DocSection
from sentry.api.serializers import serialize


class OrganizationUserTeamsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.TEAMS

    def get(self, request, organization):
        """
        List your Teams In the Current Organization
        ```````````````````````````````````````````

        Return a list of the teams available to the authenticated session and
        with the supplied organization.
        """
        return Response(serialize(list(request.access.teams), request.user))
