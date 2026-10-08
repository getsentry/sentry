import re
from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import search
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.event_search import parse_search_query
from sentry.api.helpers.environments import get_environment_func
from sentry.api.helpers.group_index import build_query_params_from_request
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializer
from sentry.api.utils import handle_query_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.snuba.utils import RPC_DATASETS
from sentry.utils.tracing import set_span_data, start_span


class OrganizationEventsMetaResponse(TypedDict):
    count: int


@cell_silo_endpoint
class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsMetaResponse", OrganizationEventsMetaResponse
            )
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[OrganizationEventsMetaResponse]:
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"count": 0})

        dataset = self.get_dataset(request, organization)

        with handle_query_errors():
            if dataset in RPC_DATASETS:
                result = dataset.run_table_query(
                    params=snuba_params,
                    query_string=request.query_params.get("query"),
                    selected_columns=["count()"],
                    orderby=None,
                    offset=0,
                    limit=1,
                    referrer=Referrer.API_ORGANIZATION_EVENTS_META,
                    config=SearchResolverConfig(),
                )

                return Response({"count": result["data"][0]["count()"]})
            else:
                result = dataset.query(
                    selected_columns=["count()"],
                    snuba_params=snuba_params,
                    query=request.query_params.get("query"),
                    referrer=Referrer.API_ORGANIZATION_EVENTS_META.value,
                    has_metrics=True,
                    # TODO: @athena - add query_source when all datasets support it
                    # query_source=(
                    #     QuerySource.FRONTEND if is_frontend_request(request) else QuerySource.API
                    # ),
                    fallback_to_transactions=True,
                )

                return Response({"count": result["data"][0]["count"]})


UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


@cell_silo_endpoint
class OrganizationEventsRelatedIssuesEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        with start_span(op="discover.endpoint", name="find_lookup_keys") as span:
            possible_keys = ["transaction"]
            lookup_keys = {key: request.query_params.get(key) for key in possible_keys}

            if not any(lookup_keys.values()):
                return Response(
                    {
                        "detail": f"Must provide one of {possible_keys} in order to find related events"
                    },
                    status=400,
                )

        with handle_query_errors():
            with start_span(op="discover.endpoint", name="filter_creation"):
                projects = self.get_projects(request, organization)
                # Filter out None values from environments
                environments = [e for e in snuba_params.environments if e is not None]
                query_kwargs = build_query_params_from_request(
                    request, organization, projects, environments
                )
                query_kwargs["limit"] = 5
                try:
                    # Need to escape quotes in case some "joker" has a transaction with quotes
                    transaction_name = UNESCAPED_QUOTE_RE.sub(
                        '\\"', lookup_keys["transaction"] or ""
                    )
                    parsed_terms = parse_search_query(f'transaction:"{transaction_name}"')
                except ParseError:
                    return Response({"detail": "Invalid transaction search"}, status=400)

                if query_kwargs.get("search_filters"):
                    query_kwargs["search_filters"].extend(parsed_terms)
                else:
                    query_kwargs["search_filters"] = parsed_terms

                query_kwargs["actor"] = request.user

            with start_span(op="discover.endpoint", name="issue_search"):
                results_cursor = search.backend.query(**query_kwargs)

        with start_span(op="discover.endpoint", name="serialize_results") as span:
            results = list(results_cursor)
            set_span_data(span, "result_length", len(results))
            context = serialize(
                results,
                request.user,
                GroupSerializer(environment_func=get_environment_func(request, organization.id)),
            )

        return Response(context)
