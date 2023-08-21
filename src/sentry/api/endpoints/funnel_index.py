from sentry.api.bases.organization import OrganizationEndpoint


class FunnelIndex(OrganizationEndpoint):
    def get(self, request, organization):
        return self.respond(status=200)
