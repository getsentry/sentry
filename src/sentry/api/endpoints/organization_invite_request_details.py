from __future__ import absolute_import


from sentry.api.bases.organization import OrganizationEndpoint


class OrganizationInviteRequestDetailsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        # TODO(epurkhiser): Add listing of invite requests
        pass

    def put(self, request, organization):
        # TODO(epurkhiser): Handle accepting invite
        pass
