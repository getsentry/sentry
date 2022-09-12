import re

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import search
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.event_search import parse_search_query
from sentry.api.helpers.group_index import build_query_params_from_request
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializer
from sentry.search.events.fields import get_function_alias
from sentry.snuba import discover, metrics_performance


@region_silo_endpoint
class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    def get(self, request: Request, organization) -> Response:
        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"count": 0})

        with self.handle_query_errors():
            result = discover.query(
                selected_columns=["count()"],
                params=params,
                query=request.query_params.get("query"),
                referrer="api.organization-events-meta",
            )

        return Response({"count": result["data"][0]["count"]})


@region_silo_endpoint
class OrganizationEventsMetricsCompatiblity(OrganizationEventsEndpointBase):
    """Metrics data can contain less than great data like null or unparameterized transactions

    This endpoint will return projects that have perfect data along with the overall counts of projects so the
    frontend can make decisions about which projects to show and related info

    DEPRECATED, replaced by 2 endpoints in organization_metrics_meta
    """

    private = True

    def get(self, request: Request, organization) -> Response:
        data = {
            "compatible_projects": [],
            "dynamic_sampling_projects": [],
            "sum": {
                "metrics": None,
                "metrics_null": None,
                "metrics_unparam": None,
            },
        }
        try:
            # This will be used on the perf homepage and contains preset queries, allow global views
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(data)
        for project in params["project_objects"]:
            dynamic_sampling = project.get_option("sentry:dynamic_sampling")
            if dynamic_sampling is not None:
                data["dynamic_sampling_projects"].append(project.id)
                if len(data["dynamic_sampling_projects"]) > 50:
                    break

        # None of the projects had DS rules, nothing is compat the sum & compat projects list is useless
        if len(data["dynamic_sampling_projects"]) == 0:
            return Response(data)
        data["dynamic_sampling_projects"].sort()

        # Save ourselves some work, only query the projects that have DS rules
        data["compatible_projects"] = params["project_id"]
        params["project_id"] = data["dynamic_sampling_projects"]

        with self.handle_query_errors():
            count_unparam = "count_unparameterized_transactions()"
            count_has_txn = "count_has_transaction_name()"
            count_null = "count_null_transactions()"
            compatible_results = metrics_performance.query(
                selected_columns=[
                    "project.id",
                    count_null,
                    count_has_txn,
                ],
                params=params,
                query=f"{count_null}:0 AND {count_has_txn}:>0",
                referrer="api.organization-events-metrics-compatibility.compatible",
                functions_acl=["count_null_transactions", "count_has_transaction_name"],
                use_aggregate_conditions=True,
            )
            data["compatible_projects"] = sorted(
                row["project.id"] for row in compatible_results["data"]
            )

            sum_metrics = metrics_performance.query(
                selected_columns=[count_unparam, count_null, "count()"],
                params=params,
                query="",
                referrer="api.organization-events-metrics-compatibility.sum_metrics",
                functions_acl=["count_unparameterized_transactions", "count_null_transactions"],
                use_aggregate_conditions=True,
            )
            if len(sum_metrics["data"]) > 0:
                data["sum"].update(
                    {
                        "metrics": sum_metrics["data"][0].get("count"),
                        "metrics_null": sum_metrics["data"][0].get(get_function_alias(count_null)),
                        "metrics_unparam": sum_metrics["data"][0].get(
                            get_function_alias(count_unparam)
                        ),
                    }
                )

        return Response(data)


UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


@region_silo_endpoint
class OrganizationEventsRelatedIssuesEndpoint(OrganizationEventsEndpointBase, EnvironmentMixin):
    def get(self, request: Request, organization) -> Response:
        try:
            # events-meta is still used by events v1 which doesn't require global views
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response([])

        with sentry_sdk.start_span(op="discover.endpoint", description="find_lookup_keys") as span:
            possible_keys = ["transaction"]
            lookup_keys = {key: request.query_params.get(key) for key in possible_keys}

            if not any(lookup_keys.values()):
                return Response(
                    {
                        "detail": f"Must provide one of {possible_keys} in order to find related events"
                    },
                    status=400,
                )

        with self.handle_query_errors():
            with sentry_sdk.start_span(op="discover.endpoint", description="filter_creation"):
                projects = self.get_projects(request, organization)
                query_kwargs = build_query_params_from_request(
                    request, organization, projects, params.get("environment")
                )
                query_kwargs["limit"] = 5
                try:
                    # Need to escape quotes in case some "joker" has a transaction with quotes
                    transaction_name = UNESCAPED_QUOTE_RE.sub('\\"', lookup_keys["transaction"])
                    parsed_terms = parse_search_query(f'transaction:"{transaction_name}"')
                except ParseError:
                    return Response({"detail": "Invalid transaction search"}, status=400)

                if query_kwargs.get("search_filters"):
                    query_kwargs["search_filters"].extend(parsed_terms)
                else:
                    query_kwargs["search_filters"] = parsed_terms

            with sentry_sdk.start_span(op="discover.endpoint", description="issue_search"):
                results = search.query(**query_kwargs)

        with sentry_sdk.start_span(op="discover.endpoint", description="serialize_results") as span:
            results = list(results)
            span.set_data("result_length", len(results))
            context = serialize(
                results,
                request.user,
                GroupSerializer(
                    environment_func=self._get_environment_func(request, organization.id)
                ),
            )

        return Response(context)
