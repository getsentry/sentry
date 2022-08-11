from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.event_search import SearchFilter, parse_search_query
from sentry.models.organization import Organization
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replays_collection, replay_config


class OrganizationReplayIndexEndpoint(OrganizationEndpoint):
    private = True

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)

        try:
            filter_params = self.get_filter_params(request, organization)
        except NoProjects:
            return Response({"data": []}, status=200)

        for key, value in request.query_params.items():
            if key not in filter_params:
                filter_params[key] = value

        search_filters = parse_search_query(request.query_params.get("query", ""), replay_config)
        search_filters = [term for term in search_filters if isinstance(term, SearchFilter)]

        snuba_response = query_replays_collection(
            project_ids=filter_params["project_id"],
            start=filter_params["start"],
            end=filter_params["end"],
            environment=filter_params.get("environment"),
            sort=filter_params.get("sort"),
            limit=filter_params.get("limit"),
            offset=filter_params.get("offset"),
            search_filters=search_filters,
        )

        response = process_raw_response(
            snuba_response,
            fields=request.query_params.getlist("field"),
        )

        return Response({"data": response}, status=200)
