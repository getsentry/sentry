from __future__ import absolute_import, division, print_function

import six

from django.conf import settings

from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.helpers.group_index import (
    rate_limit_endpoint,
    validate_search_filter_permissions,
    ValidationError,
)
from sentry.api.issue_search import convert_query_values, parse_search_query
from sentry.api.utils import get_date_range_from_params, InvalidParams
from sentry.search.snuba.backend import EventsDatasetSnubaSearchBackend
from sentry.snuba import discover


ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


search = EventsDatasetSnubaSearchBackend(**settings.SENTRY_SEARCH_OPTIONS)


class OrganizationIssuesCountEndpoint(OrganizationEventsEndpointBase):
    def _count(self, request, organization, projects, environments, extra_query_kwargs=None):
        query_kwargs = {"projects": projects}

        query = request.GET.get("query").strip()
        if query:
            search_filters = convert_query_values(
                parse_search_query(query), projects, request.user, environments
            )
            validate_search_filter_permissions(organization, search_filters, request.user)
            query_kwargs["search_filters"] = search_filters

        if extra_query_kwargs is not None:
            assert "environment" not in extra_query_kwargs
            query_kwargs.update(extra_query_kwargs)

        query_kwargs["environments"] = environments if environments else None

        return search.query(**query_kwargs)

    @rate_limit_endpoint(limit=10, window=1)
    def get(self, request, organization):
        stats_period = request.GET.get("groupStatsPeriod")
        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams as e:
            raise ParseError(detail=six.text_type(e))

        if stats_period not in (None, "", "24h", "14d", "auto"):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        environments = self.get_environments(request, organization)

        projects = self.get_projects(request, organization)

        if not projects:
            return Response([])

        if len(projects) > 1 and not features.has(
            "organizations:global-views", organization, actor=request.user
        ):
            return Response(
                {"detail": "You do not have the multi project stream feature enabled"}, status=400
            )

        try:
            cursor_result = self._count(
                request,
                organization,
                projects,
                environments,
                {"count_hits": True, "date_to": end, "date_from": start},
            )
        except (ValidationError, discover.InvalidSearchQuery) as exc:
            return Response({"detail": six.text_type(exc)}, status=400)

        return Response(cursor_result.hits)
