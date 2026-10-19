from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import traces

from sentry import features
from sentry.api.api_owners import ApiOwner
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
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.snuba import discover
from sentry.snuba.discover import HistogramResults

# The maximum number of array columns allowed to be queried at at time
MAX_ARRAY_COLS = 4

DATA_FILTERS = ["all", "exclude_outliers"]


class HistogramSerializer(serializers.Serializer):
    query = serializers.CharField(required=False)
    field = serializers.ListField(allow_empty=False, max_length=MAX_ARRAY_COLS)
    numBuckets = serializers.IntegerField(min_value=1, max_value=100)
    precision = serializers.IntegerField(default=0, min_value=0, max_value=4)
    min = serializers.FloatField(required=False)
    max = serializers.FloatField(required=False)
    dataFilter = serializers.ChoiceField(choices=DATA_FILTERS, required=False)

    def validate(self, data):
        if "min" in data and "max" in data and data["min"] > data["max"]:
            raise serializers.ValidationError("min cannot be greater than max.")
        return data

    def validate_field(self, fields):
        if len(fields) > 1:
            # Due to how the data is stored in snuba, multihistograms
            # are only possible when they are all measurements or all span op breakdowns.
            histogram_type = discover.check_multihistogram_fields(fields)
            if not histogram_type:
                detail = "You can only generate histogram for one column at a time unless they are all measurements or all span op breakdowns."
                raise serializers.ValidationError(detail)
        return fields


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationEventsHistogramEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def has_feature(self, organization, request):
        return features.has("organizations:performance-view", organization, actor=request.user)

    @extend_schema(
        operation_id="getOrganizationEventsHistogram",
        summary="Retrieve Histograms of Numeric Columns",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            VisibilityParams.QUERY,
            OpenApiParameter(
                name="field",
                location="query",
                required=True,
                type=str,
                many=True,
                description=f"The numeric columns to build histograms for. Up to {MAX_ARRAY_COLS} columns can be requested at once if they are all measurements or all span operation breakdowns.",
            ),
            OpenApiParameter(
                name="numBuckets",
                location="query",
                required=True,
                type=int,
                description="The number of buckets in each histogram, between 1 and 100.",
            ),
            OpenApiParameter(
                name="precision",
                location="query",
                required=False,
                type=int,
                description="The number of decimal places, between 0 and 4, to keep in the bucket boundaries. Defaults to 0.",
            ),
            OpenApiParameter(
                name="min",
                location="query",
                required=False,
                type=float,
                description="The lower bound of the histogram. Smaller values are dropped.",
            ),
            OpenApiParameter(
                name="max",
                location="query",
                required=False,
                type=float,
                description="The upper bound of the histogram. Larger values are dropped.",
            ),
            OpenApiParameter(
                name="dataFilter",
                location="query",
                required=False,
                type=str,
                enum=DATA_FILTERS,
                description="Set to `exclude_outliers` to drop outliers when picking the histogram range.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsHistogramResponse", HistogramResults
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Return a histogram for each requested column, keyed by column name. Each
        histogram is a list of buckets with the bucket's lower bound (`bin`) and the
        number of events in it (`count`).
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({})

        with traces.start_span(name="histogram", attributes={"sentry.op": "discover.endpoint"}):
            serializer = HistogramSerializer(data=request.GET)
            if serializer.is_valid():
                data = serializer.validated_data

                with handle_query_errors():
                    results = discover.histogram_query(
                        fields=data["field"],
                        user_query=data.get("query"),
                        snuba_params=snuba_params,
                        num_buckets=data["numBuckets"],
                        precision=data["precision"],
                        min_value=data.get("min"),
                        max_value=data.get("max"),
                        data_filter=data.get("dataFilter"),
                        referrer="api.organization-events-histogram",
                    )

                return Response(results)
            else:
                return Response(serializer.errors, status=400)
