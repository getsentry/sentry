import logging
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.grammar.sql import Condition, parse_sql_query
from sentry.snuba.utils import get_dataset

logger = logging.getLogger(__name__)


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationEventsSqlEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(
                {
                    "detail": "Discover, Performance, or Explore is required to access this endpoint."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if not features.has(
            "organizations:events-sql-grammar-api", organization=organization, actor=request.user
        ):
            return Response(
                {"detail": "You do not have access to this endpoint."},
                status=status.HTTP_403_FORBIDDEN,
            )

        referrer = request.GET.get("referrer")

        try:
            snuba_params = self.get_snuba_params(
                request,
                organization,
            )
        except NoProjects:
            return Response(
                {
                    "data": [],
                    "meta": {
                        "tips": {
                            "query": "Need at least one valid project to query.",
                        },
                    },
                }
            )

        query = request.GET.get("query")
        if query is None:
            raise ParseError("query is a required field")
        parsed_query = parse_sql_query(query)
        dataset = get_dataset(parsed_query["dataset"])
        if dataset is None:
            raise ParseError("a FROM condition is required to query events")

        def where_to_string(where: list[Condition]) -> str:
            result = []
            for condition in where:
                if condition["operator"] == "=":
                    result.append(f"{condition['column']}:{condition['value']}")
            return " AND ".join(result)

        def _handle_results(results: Any) -> Any:
            # Apply error upsampling for regular Events API
            return self.handle_results_with_meta(
                request,
                organization,
                snuba_params.project_ids,
                results,
                standard_meta=True,
                dataset=dataset,
            )

        with handle_query_errors():
            results = dataset.run_table_query(
                params=snuba_params,
                query_string=where_to_string(parsed_query["where"]),
                selected_columns=parsed_query["fields"],
                config=SearchResolverConfig(),
                orderby=[
                    f"{'-' if orderby['direction'] == 'DESC' else ''}{orderby['column']}"
                    for orderby in parsed_query["orderby"]
                ],
                offset=0,
                limit=50,
                referrer=referrer,
            )
            return Response(_handle_results(results))
