from __future__ import absolute_import

import logging

from functools import partial
from rest_framework.response import Response

from sentry.api.bases import (
    OrganizationEventsEndpointBase,
    OrganizationEventsV2EndpointBase,
    NoProjects,
)
from sentry.api.helpers.events import get_direct_hit_response
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import EventSerializer, serialize, SimpleEventSerializer
from sentry import eventstore
from sentry.snuba import discover
from sentry.models.project import Project

logger = logging.getLogger(__name__)


class OrganizationEventsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        # Check for a direct hit on event ID
        query = request.GET.get("query", "").strip()

        try:
            direct_hit_resp = get_direct_hit_response(
                request,
                query,
                self.get_filter_params(request, organization),
                "api.organization-events-direct-hit",
            )
        except NoProjects:
            pass
        else:
            if direct_hit_resp:
                return direct_hit_resp

        full = request.GET.get("full", False)
        try:
            snuba_args = self.get_snuba_query_args_legacy(request, organization)
        except NoProjects:
            # return empty result if org doesn't have projects
            # or user doesn't have access to projects in org
            data_fn = lambda *args, **kwargs: []
        else:
            data_fn = partial(
                eventstore.get_events,
                referrer="api.organization-events",
                filter=eventstore.Filter(
                    start=snuba_args["start"],
                    end=snuba_args["end"],
                    conditions=snuba_args["conditions"],
                    project_ids=snuba_args["filter_keys"].get("project_id", None),
                    group_ids=snuba_args["filter_keys"].get("group_id", None),
                ),
            )

        serializer = EventSerializer() if full else SimpleEventSerializer()
        return self.paginate(
            request=request,
            on_results=lambda results: serialize(results, request.user, serializer),
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )

    def handle_results(self, request, organization, project_ids, results):
        fields = request.GET.getlist("field")

        if "project.name" in fields:
            projects = {
                p["id"]: p["slug"]
                for p in Project.objects.filter(
                    organization=organization, id__in=project_ids
                ).values("id", "slug")
            }
            for result in results:
                result["project.name"] = projects[result["project.id"]]
                if "project.id" not in fields:
                    del result["project.id"]

        return results


class OrganizationEventsV2Endpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        def data_fn(offset, limit):
            return discover.query(
                selected_columns=request.GET.getlist("field")[:],
                query=request.GET.get("query"),
                params=params,
                orderby=self.get_orderby(request),
                offset=offset,
                limit=limit,
                referrer=request.GET.get("referrer", "api.organization-events-v2"),
                auto_fields=True,
                use_aggregate_conditions=True,
            )

        with self.handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=lambda results: self.handle_results_with_meta(
                    request, organization, params["project_id"], results
                ),
            )
