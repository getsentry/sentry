from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.replays.utils import proxy_replays_service


class OrganizationReplayIndexEndpoint(OrganizationEndpoint):
    private = True

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)

        try:
            filter_params = self.get_filter_params(request, organization)
        except NoProjects:
            return Response([])

        for key, value in request.query_params.items():
            if key not in filter_params:
                filter_params[key] = value

        return proxy_replays_service("GET", "/api/v1/replays/", filter_params)
