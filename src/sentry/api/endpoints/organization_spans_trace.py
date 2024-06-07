import sentry_sdk
from django.http import HttpRequest, HttpResponse
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.utils import handle_query_errors, update_snuba_params_with_timestamp
from sentry.models.organization import Organization
from sentry.search.events.builder import SpansIndexedQueryBuilder
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.validators import INVALID_ID_DETAILS, is_event_id


class OrganizationSpansTraceEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def query_trace_data(self, params, trace_id):
        builder = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            query=f"trace:{trace_id}",
            selected_columns=[
                "id",
                "is_transaction",
                "precise.start_ts",
                "precise.finish_ts",
                # Trying to get almost everything here
                "user",
                "user.id",
                "user.email",
                "user.username",
                "profile.id",
                "cache.hit",
                "transaction.method",
                "system",
                "raw_domain",
                "release",
                "environment",
                "device.class",
                "category",
                "span.category",
                "span.status_code",
                "replay.id",
                "resource.render_blocking_status",
                "http.response_content_length",
                "http.decoded_response_content_length",
                "http.response_transfer_size",
                "app_start_type",
                "browser.name",
                "origin.transaction",
                "is_transaction",
                "sdk.name",
                "trace.status",
                "messaging.destination.name",
                "messaging.message.id",
                "tags.key",
                "tags.value",
            ],
            orderby="precise.start_ts",
            limit=10_000,
        )
        result = builder.run_query(referrer=Referrer.API_SPANS_TRACE_VIEW.value)
        sentry_sdk.set_measurement("spans_trace.result_count", len(result["data"]))
        return result

    def has_feature(self, organization: Organization, request: HttpRequest) -> bool:
        return bool(
            features.has("organizations:trace-spans-format", organization, actor=request.user)
        )

    def get(self, request: HttpRequest, organization: Organization, trace_id: str) -> HttpResponse:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            # The trace view isn't useful without global views, so skipping the check here
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        update_snuba_params_with_timestamp(request, params)

        # Bias the results to include any given event_id - note because this loads spans without taking trace topology
        # into account, the descendents of this event might not be in the response
        event_id = request.GET.get("event_id") or request.GET.get("eventId")

        # Only need to validate event_id as trace_id is validated in the URL
        if event_id and not is_event_id(event_id):
            return Response({"detail": INVALID_ID_DETAILS.format("Event ID")}, status=400)

        with handle_query_errors():
            spans = self.query_trace_data(params, trace_id)
            if len(spans) == 0:
                return Response(status=404)

        return Response(spans)
