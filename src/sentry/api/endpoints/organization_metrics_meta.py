from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.search.events.fields import get_function_alias
from sentry.snuba import metrics_performance

COUNT_UNPARAM = "count_unparameterized_transactions()"
COUNT_HAS_TXN = "count_has_transaction_name()"
COUNT_NULL = "count_null_transactions()"


@region_silo_endpoint
class OrganizationMetricsCompatibility(OrganizationEventsEndpointBase):
    """Metrics data can contain less than great data like null or unparameterized transactions

    This endpoint will return projects that have dynamic sampling turned on, and another list of "compatible projects"
    which are the projects which don't have null transactions and have at least 1 transaction with a valid name
    """

    private = True

    def get(self, request: Request, organization) -> Response:
        data = {
            "incompatible_projects": [],
            "compatible_projects": [],
        }
        try:
            # This will be used on the perf homepage and contains preset queries, allow global views
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(data)
        original_project_ids = params["project_id"].copy()

        with self.handle_query_errors():
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
            data["incompatible_projects"] = sorted(
                list(set(original_project_ids) - set(data["compatible_projects"]))[
                    : request.GET.get("per_page", 50)
                ]
            )

        return Response(data)


@region_silo_endpoint
class OrganizationMetricsCompatibilitySums(OrganizationEventsEndpointBase):
    """Return the total sum of metrics data, the null transactions and unparameterized transactions

    This is so the frontend can have an idea given its current selection of projects how good/bad the display would
    be
    """

    private = True

    def get(self, request: Request, organization) -> Response:
        data = {
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

        with self.handle_query_errors():
            sum_metrics = metrics_performance.query(
                selected_columns=[COUNT_UNPARAM, COUNT_NULL, "count()"],
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
                        "metrics_null": sum_metrics["data"][0].get(get_function_alias(COUNT_NULL)),
                        "metrics_unparam": sum_metrics["data"][0].get(
                            get_function_alias(COUNT_UNPARAM)
                        ),
                    }
                )

        return Response(data)
