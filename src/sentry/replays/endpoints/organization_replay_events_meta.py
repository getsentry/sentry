from typing import Sequence

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models import Organization
from sentry.snuba import discover


@region_silo_endpoint
class OrganizationReplayEventsMetaEndpoint(OrganizationEventsV2EndpointBase):
    """The generic Events endpoints require that the `organizations:global-views` feature
    be enabled before they return across multiple projects.

    This endpoint is purpose built for the Session Replay product which intentionally
    requests data across multiple transactions, and therefore potentially multiple projects.
    This is similar to performance, and modeled after `OrganizationEventsMetaEndpoint`.

    This endpoint offers a narrow interface specific to the requirements of `useReplayData.tsx`
    """

    private = True

    def get_field_list(self, organization: Organization, request: Request) -> Sequence[str]:
        return [
            "error.type",
            "error.value",  # Deprecated, use title instead. See replayDataUtils.tsx
            "id",
            "issue.id",
            "issue",
            "timestamp",
            "title",
        ]

    def get(self, request: Request, organization) -> Response:
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response({"count": 0})

        def data_fn(offset, limit):
            query_details = {
                "selected_columns": self.get_field_list(organization, request),
                "query": request.GET.get("query"),
                "params": params,
                "equations": self.get_equation_list(organization, request),
                "orderby": self.get_orderby(request),
                "offset": offset,
                "limit": limit,
                "referrer": "api.replay.details-page",
                "auto_fields": True,
                "auto_aggregations": True,
                "use_aggregate_conditions": True,
                "allow_metric_aggregates": False,
                "transform_alias_to_input_format": True,
            }

            return discover.query(**query_details)

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: self.handle_results_with_meta(
                request,
                organization,
                params["project_id"],
                results,
                standard_meta=True,
            ),
        )
