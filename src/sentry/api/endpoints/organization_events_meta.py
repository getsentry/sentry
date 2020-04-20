from __future__ import absolute_import

import six
from django.conf import settings

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry.api.base import EnvironmentMixin
from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.helpers.group_index import build_query_params_from_request
from sentry.api.event_search import parse_search_query
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializer
from sentry.search.snuba.backend import EventsDatasetSnubaSearchBackend
from sentry.snuba import discover


IssueSeach = EventsDatasetSnubaSearchBackend(**settings.SENTRY_SEARCH_OPTIONS)


class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        try:
            params = self.get_filter_params(request, organization)
        except OrganizationEventsError as e:
            return Response({"detail": six.text_type(e)}, status=400)
        except NoProjects:
            return Response({"count": 0})

        try:
            result = discover.query(
                selected_columns=["count()"],
                params=params,
                query=request.query_params.get("query"),
                referrer="api.organization-events-meta",
            )
        except discover.InvalidSearchQuery as err:
            raise ParseError(detail=six.text_type(err))

        return Response({"count": result["data"][0]["count"]})


class OrganizationEventsRelatedIssuesEndpoint(OrganizationEventsEndpointBase, EnvironmentMixin):
    def get(self, request, organization):
        try:
            params = self.get_filter_params(request, organization)
        except OrganizationEventsError as e:
            return Response({"detail": six.text_type(e)}, status=400)
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
            projects = self.get_projects(request, organization)
            query_kwargs = build_query_params_from_request(
                request, organization, projects, params["environment"]
            )
            query_kwargs["limit"] = 5
            try:
                parsed_terms = parse_search_query(
                    'transaction:"{}"'.format(lookup_keys["transaction"])
                )
            except ParseError as e:
                return Response({"detail": "Invalid transaction search"}, status=400)

            if query_kwargs.get("search_filters"):
                query_kwargs["search_filters"].extend(parsed_terms)
            else:
                query_kwargs["search_filters"] = parsed_terms

            results = IssueSeach.query(**query_kwargs)
        except discover.InvalidSearchQuery as err:
            raise ParseError(detail=six.text_type(err))

        context = serialize(
            list(results),
            request.user,
            GroupSerializer(environment_func=self._get_environment_func(request, organization.id)),
        )

        return Response(context)
