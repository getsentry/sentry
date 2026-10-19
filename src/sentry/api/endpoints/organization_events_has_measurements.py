from datetime import timedelta
from typing import TypedDict

from django.core.cache import cache
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import traces

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.snuba import discover
from sentry.utils.hashlib import md5_text

MEASUREMENT_TYPES = {
    "web": [
        "measurements.fp",
        "measurements.fcp",
        "measurements.lcp",
        "measurements.fid",
        "measurements.cls",
    ],
    "mobile": [
        "measurements.app_start_cold",
        "measurements.app_start_warm",
        "measurements.frames_total",
        "measurements.frames_slow",
        "measurements.frames_frozen",
        "measurements.stall_count",
        "measurements.stall_stall_total_time",
        "measurements.stall_stall_longest_time",
    ],
}


class EventsHasMeasurementsResponse(TypedDict):
    measurements: bool


class EventsHasMeasurementsQuerySerializer(serializers.Serializer):
    transaction = serializers.CharField(max_length=200)
    type = serializers.ChoiceField(choices=list(MEASUREMENT_TYPES.keys()))

    def validate(self, data):
        # only allow one project at a time in order to cache the results
        # for a unique transaction
        project_ids = self.context.get("project_ids", [])
        if len(project_ids) != 1:
            raise serializers.ValidationError("Only 1 project allowed.")
        return data


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationEventsHasMeasurementsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="getOrganizationEventsHasMeasurements",
        summary="Check if a Transaction Has Measurements",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            OpenApiParameter(
                name="transaction",
                location="query",
                required=True,
                type=str,
                description="The name of the transaction.",
            ),
            OpenApiParameter(
                name="type",
                location="query",
                required=True,
                type=str,
                enum=list(MEASUREMENT_TYPES.keys()),
                description="The kind of measurements to look for: `web` vitals or `mobile` vitals.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsHasMeasurementsResponse", EventsHasMeasurementsResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> (
        Response[EventsHasMeasurementsResponse] | Response[ValidationErrorResponse] | Response[None]
    ):
        """
        Check whether a transaction in a single project has any events with web or mobile
        measurements in the last 7 days. The time range parameters are ignored.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        with traces.start_span(name="parse params", attributes={"sentry.op": "discover.endpoint"}):
            try:
                snuba_params = self.get_snuba_params(request, organization)

                # Once an transaction begins containing measurement data, it is unlikely
                # it will stop. So it makes more sense to always query the latest data.
                #
                # Additionally, to account for periods of low volume, increase the range
                # to 7 days to have a better chance of finding an example event and provide
                # a more consistent experience.
                now = timezone.now()
                snuba_params.start = now - timedelta(days=7)
                snuba_params.end = now
            except NoProjects:
                return Response({"measurements": False})

            data = {
                "transaction": request.GET.get("transaction"),
                "type": request.GET.get("type"),
            }

            serializer = EventsHasMeasurementsQuerySerializer(
                data=data, context={"project_ids": snuba_params.project_ids}
            )
            if not serializer.is_valid():
                return Response(as_validation_errors(serializer), status=400)

        org_id = organization.id
        project_id = snuba_params.project_ids[0]
        md5_hash = md5_text(data["transaction"], data["type"]).hexdigest()

        cache_key = f"check-events-measurements:{org_id}:{project_id}:{md5_hash}"
        has_measurements = cache.get(cache_key)

        # cache miss, need to make the query again
        if has_measurements is None:
            with handle_query_errors():
                validated_data = serializer.validated_data

                # generate the appropriate query for the selected type
                transaction_query = f"transaction:{validated_data['transaction']}"
                measurements = MEASUREMENT_TYPES[validated_data["type"]]
                has_queries = [f"has:{measurement}" for measurement in measurements]
                measurement_query = " OR ".join(has_queries)
                query = f"{transaction_query} ({measurement_query})"

                results = discover.query(
                    selected_columns=["id"],
                    query=query,
                    snuba_params=snuba_params,
                    limit=1,  # Just want to check for existence of such an event
                    referrer="api.events.measurements",
                    auto_fields=True,
                    auto_aggregations=False,
                    use_aggregate_conditions=False,
                )
            has_measurements = len(results["data"]) > 0

            # cache the results for 5 minutes
            cache.set(cache_key, has_measurements, 300)

        return Response({"measurements": has_measurements})
