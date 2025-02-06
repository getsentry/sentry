from typing import TypedDict

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
from sentry.search.events.builder.spans_indexed import SpansIndexedQueryBuilder
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.validators import INVALID_ID_DETAILS, is_event_id


class SnubaTrace(TypedDict):
    span_op: str
    span_description: str
    id: str
    is_transaction: bool
    start_ts: float
    finish_ts: float


@region_silo_endpoint
class OrganizationSpansTraceEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @sentry_sdk.tracing.trace
    def query_trace_data(self, snuba_params: SnubaParams, trace_id: str) -> list[SnubaTrace]:
        builder = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params={},
            snuba_params=snuba_params,
            query=f"trace:{trace_id}",
            selected_columns=[
                "span.op",
                "span.description",
                "id",
                "is_transaction",
                "precise.start_ts",
                "precise.finish_ts",
            ],
            orderby="precise.start_ts",
            limit=10_000,
        )
        query_result = builder.run_query(referrer=Referrer.API_SPANS_TRACE_VIEW.value)
        result: list[SnubaTrace] = []
        measurement_transaction_count = 0
        for row in query_result["data"]:
            result.append(
                {
                    "span_op": row["span.op"],
                    "span_description": row["span.description"],
                    "id": row["id"],
                    "is_transaction": row["is_transaction"] == 1,
                    "start_ts": row["precise.start_ts"],
                    "finish_ts": row["precise.finish_ts"],
                }
            )
            if row["is_transaction"] == 1:
                measurement_transaction_count += 1
        sentry_sdk.set_measurement("spans_trace.count.transactions", measurement_transaction_count)
        sentry_sdk.set_measurement("spans_trace.count.spans", len(result))
        sentry_sdk.set_measurement(
            "spans_trace.count.non_transactions", len(result) - measurement_transaction_count
        )
        return result

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

        # Bias the results to include any given event_id - note because this loads spans without taking trace topology
        # into account, the descendents of this event might not be in the response
        event_id = request.GET.get("event_id") or request.GET.get("eventId")

        # Only need to validate event_id as trace_id is validated in the URL
        if event_id and not is_event_id(event_id):
            return Response({"detail": INVALID_ID_DETAILS.format("Event ID")}, status=400)

        def data_fn(offset: int, limit: int) -> list[SnubaTrace]:
            """API requires pagination even though it doesn't really work yet... ignoring limit and offset for now"""
            with handle_query_errors():
                spans = self.query_trace_data(snuba_params, trace_id)
            return spans

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
