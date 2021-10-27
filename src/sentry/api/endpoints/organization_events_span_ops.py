from typing import Any, TypedDict

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models import Organization
from sentry.search.events.builder import QueryBuilder
from sentry.utils.snuba import Dataset, raw_snql_query


class SpanOp(TypedDict):
    op: str
    count: int


class OrganizationEventsSpanOpsEndpoint(OrganizationEventsEndpointBase):  # type: ignore
    def has_feature(self, request: Request, organization: Organization) -> bool:
        return bool(
            features.has(
                "organizations:performance-suspect-spans-view",
                organization,
                actor=request.user,
            )
        )

    def get(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(request, organization):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        query = request.GET.get("query")

        def data_fn(offset: int, limit: int) -> Any:
            builder = QueryBuilder(
                dataset=Dataset.Discover,
                params=params,
                selected_columns=["spans_op", "count()"],
                array_join="spans_op",
                query=query,
                limit=limit,
                offset=offset,
                orderby="-count",
            )
            snql_query = builder.get_snql_query()
            results = raw_snql_query(snql_query, "api.organization-events-span-ops")
            return [SpanOp(op=row["spans_op"], count=row["count"]) for row in results["data"]]

        with self.handle_query_errors():
            return self.paginate(
                request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                default_per_page=20,
                max_per_page=20,
            )
