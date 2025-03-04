from datetime import datetime
from typing import Any, TypedDict

import sentry_sdk
from django.http import HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors, update_snuba_params_with_timestamp
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import run_trace_query


class SerializedEvent(TypedDict):
    children: list["SerializedEvent"]
    event_id: str
    parent_span_id: str | None
    project_id: int
    project_slug: str
    start_timestamp: datetime | None
    end_timestamp: datetime | None
    transaction: str
    description: str
    duration: float
    is_transaction: bool
    op: str
    event_type: str


@region_silo_endpoint
class OrganizationSpansTraceEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def serialize_rpc_span(self, span: dict[str, Any]) -> SerializedEvent:
        return SerializedEvent(
            children=[self.serialize_rpc_span(child) for child in span["children"]],
            event_id=span["id"],
            project_id=span["project.id"],
            project_slug=span["project.slug"],
            parent_span_id=None if span["parent_span"] == "0" * 16 else span["parent_span"],
            start_timestamp=span["precise.start_ts"],
            end_timestamp=span["precise.finish_ts"],
            duration=span["span.duration"],
            transaction=span["transaction"],
            is_transaction=span["is_transaction"],
            description=span["description"],
            op=span["span.op"],
            event_type="span",
        )

    @sentry_sdk.tracing.trace
    def query_trace_data(self, snuba_params: SnubaParams, trace_id: str) -> list[SerializedEvent]:
        trace_data = run_trace_query(
            trace_id, snuba_params, Referrer.API_TRACE_VIEW_GET_EVENTS.value, SearchResolverConfig()
        )
        result = []
        id_to_event = {event["id"]: event for event in trace_data}
        for span in trace_data:
            if span["parent_span"] in id_to_event:
                parent = id_to_event[span["parent_span"]]
                parent["children"].append(span)
            else:
                result.append(span)
        return [self.serialize_rpc_span(root) for root in result]

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return bool(
            features.has("organizations:trace-spans-format", organization, actor=request.user)
        )

    def get(self, request: Request, organization: Organization, trace_id: str) -> HttpResponse:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            # The trace view isn't useful without global views, so skipping the check here
            snuba_params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        update_snuba_params_with_timestamp(request, snuba_params)

        def data_fn(offset: int, limit: int) -> list[SerializedEvent]:
            """offset and limit don't mean anything on this endpoint currently"""
            with handle_query_errors():
                spans = self.query_trace_data(snuba_params, trace_id)
            return spans

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
