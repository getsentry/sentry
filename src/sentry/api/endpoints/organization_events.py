from __future__ import absolute_import

import logging
import six
import uuid
from functools import partial
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from semaphore.consts import SPAN_STATUS_CODE_TO_NAME
from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.event_search import get_json_meta_type
from sentry.api.helpers.events import get_direct_hit_response
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import EventSerializer, serialize, SimpleEventSerializer
from sentry import eventstore, features
from sentry.snuba import discover
from sentry.utils import snuba
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
        except (OrganizationEventsError, NoProjects):
            pass
        else:
            if direct_hit_resp:
                return direct_hit_resp

        full = request.GET.get("full", False)
        try:
            snuba_args = self.get_snuba_query_args_legacy(request, organization)
        except OrganizationEventsError as exc:
            return Response({"detail": exc.message}, status=400)
        except NoProjects:
            # return empty result if org doesn't have projects
            # or user doesn't have access to projects in org
            data_fn = lambda *args, **kwargs: []
        else:
            cols = None if full else eventstore.full_columns

            data_fn = partial(
                eventstore.get_events,
                additional_columns=cols,
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
        projects = {
            p["id"]: p["slug"]
            for p in Project.objects.filter(organization=organization, id__in=project_ids).values(
                "id", "slug"
            )
        }

        fields = request.GET.getlist("field")

        if "project.name" in fields:
            for result in results:
                result["project.name"] = projects[result["project.id"]]
                if "project.id" not in fields:
                    del result["project.id"]

        return results


class OrganizationEventsV2Endpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        if not features.has("organizations:events-v2", organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_filter_params(request, organization)
        except OrganizationEventsError as exc:
            raise ParseError(detail=six.text_type(exc))
        except NoProjects:
            return Response([])

        has_global_views = features.has(
            "organizations:global-views", organization, actor=request.user
        )
        if not has_global_views and len(params.get("project_id", [])) > 1:
            raise ParseError(detail="You cannot view events from multiple projects.")

        def data_fn(offset, limit):
            return discover.query(
                selected_columns=request.GET.getlist("field")[:],
                query=request.GET.get("query"),
                params=params,
                reference_event=self.reference_event(request, organization),
                orderby=self.get_orderby(request),
                offset=offset,
                limit=limit,
                referrer="api.organization-events-v2",
                auto_fields=True,
            )

        try:
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=lambda results: self.handle_results_with_meta(
                    request, organization, params["project_id"], results
                ),
            )
        except discover.InvalidSearchQuery as error:
            raise ParseError(detail=six.text_type(error))
        except snuba.SnubaError as error:
            logger.info(
                "organization.events.snuba-error",
                extra={
                    "organization_id": organization.id,
                    "user_id": request.user.id,
                    "error": six.text_type(error),
                },
            )
            raise ParseError(detail="Invalid query.")

    def handle_results_with_meta(self, request, organization, project_ids, results):
        data = self.handle_data(request, organization, project_ids, results.get("data"))
        if not data:
            return {"data": [], "meta": {}}

        meta = {
            value["name"]: get_json_meta_type(value["name"], value["type"])
            for value in results["meta"]
        }
        # Ensure all columns in the result have types.
        for key in data[0]:
            if key not in meta:
                meta[key] = "string"
        return {"meta": meta, "data": data}

    def handle_data(self, request, organization, project_ids, results):
        if not results:
            return results

        first_row = results[0]

        # TODO(mark) move all of this result formatting into discover.query()
        # once those APIs are used across the application.
        tests = {
            "transaction.status": "transaction.status" in first_row,
            "trace": "trace" in first_row,
            "trace.span": "trace.span" in first_row,
        }
        if any(tests.values()):
            for row in results:
                if tests["transaction.status"]:
                    row["transaction.status"] = SPAN_STATUS_CODE_TO_NAME.get(
                        row["transaction.status"]
                    )
                if tests["trace"]:
                    row["trace"] = uuid.UUID(row["trace"]).hex
                if tests["trace.span"]:
                    row["trace.span"] = hex(row["trace.span"]).lstrip("0x").rstrip("L")

        if not ("project.id" in first_row or "projectid" in first_row):
            return results
        fields = request.GET.getlist("field")
        projects = {
            p["id"]: p["slug"]
            for p in Project.objects.filter(organization=organization, id__in=project_ids).values(
                "id", "slug"
            )
        }
        for result in results:
            for key in ("projectid", "project.id"):
                if key in result:
                    result["project.name"] = projects[result[key]]
                    if key not in fields:
                        del result[key]

        return results
