from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.snuba import discover


@region_silo_endpoint
class OrganizationReplayEventsMetaEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request: Request, organization) -> Response:
        try:
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response({"count": 0})

        def data_fn(offset, limit):
            query_details = {
                "selected_columns": [
                    "id",
                    "error.value",
                    "timestamp",
                    "error.type",
                    "issue.id",
                ],
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
