from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.event_search import parse_search_query
from sentry.api.paginator import GenericOffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replays_collection, replay_url_parser_config
from sentry.replays.validators import ReplayValidator


@region_silo_endpoint
class OrganizationReplayIndexEndpoint(OrganizationEndpoint):
    def get_replay_filter_params(self, request, organization):

        query_referrer = request.GET.get("queryReferrer", None)

        filter_params = self.get_filter_params(request, organization)

        has_global_views = (
            features.has("organizations:global-views", organization, actor=request.user)
            or query_referrer == "issueReplays"
        )

        if not has_global_views and len(filter_params.get("project_id", [])) > 1:
            raise ParseError(detail="You cannot view events from multiple projects.")

        return filter_params

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)
        try:
            filter_params = self.get_replay_filter_params(request, organization)
        except NoProjects:
            return Response({"data": []}, status=200)

        result = ReplayValidator(data=request.GET)
        if not result.is_valid():
            raise ParseError(result.errors)

        for key, value in result.validated_data.items():
            if key not in filter_params:
                filter_params[key] = value

        def data_fn(offset, limit):
            try:
                search_filters = parse_search_query(
                    request.query_params.get("query", ""), config=replay_url_parser_config
                )
            except InvalidSearchQuery as e:
                raise ParseError(str(e))

            return query_replays_collection(
                project_ids=filter_params["project_id"],
                start=filter_params["start"],
                end=filter_params["end"],
                environment=filter_params.get("environment"),
                sort=filter_params.get("sort"),
                fields=request.query_params.getlist("field"),
                limit=limit,
                offset=offset,
                search_filters=search_filters,
                organization=organization,
                actor=request.user,
            )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: {
                "data": process_raw_response(
                    results,
                    fields=request.query_params.getlist("field"),
                )
            },
        )
