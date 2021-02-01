import re
import sentry_sdk

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry import search, eventstore
from sentry.api.base import EnvironmentMixin
from sentry.api.bases import OrganizationEventsEndpointBase, NoProjects
from sentry.api.helpers.group_index import build_query_params_from_request
from sentry.api.event_search import parse_search_query, get_function_alias
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializer
from sentry.snuba import discover


class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
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


class OrganizationEventBaseline(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        """ Find the event id with the closest value to an aggregate for a given query """
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        # Assumption is that users will want the 50th percentile
        baseline_function = request.GET.get("baselineFunction", "p50()")
        # If the baseline was calculated already save ourselves a query
        baseline_value = request.GET.get("baselineValue")
        baseline_alias = get_function_alias(baseline_function)

        with self.handle_query_errors():
            if baseline_value is None:
                result = discover.query(
                    selected_columns=[baseline_function],
                    params=params,
                    query=request.GET.get("query"),
                    limit=1,
                    referrer="api.transaction-baseline.get_value",
                )
                baseline_value = result["data"][0].get(baseline_alias) if "data" in result else None
                if baseline_value is None:
                    return Response(status=404)

            delta_column = "absolute_delta(transaction.duration,{})".format(baseline_value)

            result = discover.query(
                selected_columns=[
                    "project",
                    "timestamp",
                    "id",
                    "transaction.duration",
                    delta_column,
                ],
                # Find the most recent transaction that's closest to the baseline value
                # id is the last item of the orderby for consistent results
                orderby=[get_function_alias(delta_column), "-timestamp", "id"],
                params=params,
                query=request.GET.get("query"),
                limit=1,
                referrer="api.transaction-baseline.get_id",
            )
            if len(result["data"]) == 0:
                return Response(status=404)

        baseline_data = result["data"][0]
        baseline_data[baseline_alias] = baseline_value
        return Response(baseline_data)


class OrganizationEventsTrace(OrganizationEventsEndpointBase):
    def get(self, request, organization, trace_id):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        # Get 100 events from snuba, and pray these help
        with self.handle_query_errors():
            result = discover.query(
                selected_columns=[
                    "id",
                    "timestamp",
                    "transaction",
                    "project_id",
                    "trace.span",
                    "trace.parent_span",
                ],
                orderby=["-timestamp", "trace.parent_span", "id"],
                params=params,
                query=f"event.type:transaction trace:{trace_id}",
                limit=100,
                referrer="experimental.api.trace-view.get_ids",
            )
            if len(result["data"]) == 0:
                return Response(status=404)

        root_data = [item for item in result["data"] if item["trace.parent_span"] == ""][0]
        root = eventstore.get_event_by_id(root_data["project_id"], root_data["id"])
        root_span_id = root_data["trace.span"]
        transaction_map = {root_span_id: root_data["transaction"]}
        trace = {}
        trace[root_span_id] = {span["span_id"]: [] for span in root.data.get("spans", [])}

        project_map = {item["trace.parent_span"]: item for item in result["data"]}
        project_map.update({item["trace.span"]: item for item in result["data"]})
        transaction_map = {item["trace.span"]: item["transaction"] for item in result["data"]}
        # TODO trace should either all be span ids or parent span ids
        transaction_map.update(
            {item["trace.parent_span"]: item["transaction"] for item in result["data"]}
        )
        with sentry_sdk.start_span(op="fill_children"):
            self.fill_children(root_span_id, project_map, trace)
        return Response(self.map_transaction(trace, transaction_map))

    def fill_children(self, span_id, project_map, trace):
        to_delete = []

        for child_id in trace[span_id].keys():
            if child_id in project_map:
                child = project_map[child_id]
                child_event = eventstore.get_event_by_id(child["project_id"], child["id"])
                if child_event:
                    trace[span_id][child_id] = {
                        span["span_id"]: [] for span in child_event.data.get("spans", [])
                    }
                    self.fill_children(child_id, project_map, trace[span_id])
            else:
                to_delete.append(child_id)
        for item in to_delete:
            del trace[span_id][item]

    def map_transaction(self, trace, transaction_map):
        return {
            transaction_map.get(item): self.map_transaction(trace[item], transaction_map)
            for item in trace.keys()
        }


UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


class OrganizationEventsRelatedIssuesEndpoint(OrganizationEventsEndpointBase, EnvironmentMixin):
    def get(self, request, organization):
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
                        "detail": "Must provide one of {} in order to find related events".format(
                            possible_keys
                        )
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
                    parsed_terms = parse_search_query('transaction:"{}"'.format(transaction_name))
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
