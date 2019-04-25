from __future__ import absolute_import

from sentry import features
from sentry.api.bases import OrganizationEndpoint


class OrganizationIncidentsIndexEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        List saved incidents for organization
        """
        if not features.has('organizations:incidents', organization, actor=request.user):
            return self.respond(status=404)

        # TODO: implement
        return self.respond([], status=200)
