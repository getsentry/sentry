from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models.organization import Organization
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replays_collection
from sentry.replays.serializers import ReplaySerializer


class OrganizationReplayIndexEndpoint(OrganizationEndpoint):
    private = True

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)

        try:
            filter_params = self.get_filter_params(request, organization)
        except NoProjects:
            return Response({"data": []}, status=200)

        serializer = ReplaySerializer(data=request.GET)
        if not serializer.is_valid():
            raise ParseError(serializer.errors)

        for key, value in request.query_params.items():
            if key not in filter_params:
                filter_params[key] = value

        def data_fn(offset, limit):
            return query_replays_collection(
                project_ids=filter_params["project_id"],
                start=filter_params["start"],
                end=filter_params["end"],
                environment=filter_params.get("environment"),
                sort=filter_params.get("sort"),
                limit=limit,
                offset=offset,
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
