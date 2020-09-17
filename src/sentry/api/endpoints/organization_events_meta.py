from __future__ import absolute_import

import re
import sentry_sdk

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry import search
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
                # id as the last item for consistent results
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


UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


class OrganizationEventsRelatedIssuesEndpoint(OrganizationEventsEndpointBase, EnvironmentMixin):
    def get(self, request, organization):
        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        with sentry_sdk.start_span(op="discover.endpoint", description="find_lookup_keys") as span:
            span.set_data("organization", organization)

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
