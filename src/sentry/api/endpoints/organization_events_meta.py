from __future__ import absolute_import

import re
import sentry_sdk
import six

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry import search
from sentry.api.base import EnvironmentMixin
from sentry.api.bases import OrganizationEventsEndpointBase, NoProjects
from sentry.api.helpers.group_index import build_query_params_from_request
from sentry.api.event_search import parse_search_query
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializer
from sentry.snuba import discover
from sentry.utils import snuba


class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        with sentry_sdk.start_span(op="discover.endpoint", description="filter_params") as span:
            span.set_data("organization", organization)
            try:
                params = self.get_filter_params(request, organization)
            except NoProjects:
                return Response({"count": 0})
            params = self.quantize_date_params(request, params)

        try:
            result = discover.query(
                selected_columns=["count()"],
                params=params,
                query=request.query_params.get("query"),
                referrer="api.organization-events-meta",
            )
        except (discover.InvalidSearchQuery, snuba.QueryOutsideRetentionError) as error:
            raise ParseError(detail=six.text_type(error))

        return Response({"count": result["data"][0]["count"]})


UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


class OrganizationEventsRelatedIssuesEndpoint(OrganizationEventsEndpointBase, EnvironmentMixin):
    def get(self, request, organization):
        with sentry_sdk.start_span(op="discover.endpoint", description="filter_params") as span:
            span.set_data("organization", organization)
            try:
                params = self.get_filter_params(request, organization)
            except NoProjects:
                return Response([])

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

        try:
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
        except discover.InvalidSearchQuery as err:
            raise ParseError(detail=six.text_type(err))

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
