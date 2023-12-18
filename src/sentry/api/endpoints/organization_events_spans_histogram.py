import sentry_sdk
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.endpoints.organization_events_spans_performance import Span
from sentry.snuba import discover

DATA_FILTERS = ["all", "exclude_outliers"]


class SpansHistogramSerializer(serializers.Serializer):
    span = serializers.CharField(required=True, allow_null=False)
    query = serializers.CharField(required=False)
    numBuckets = serializers.IntegerField(min_value=1, max_value=100)
    precision = serializers.IntegerField(default=0, min_value=0, max_value=4)
    min = serializers.FloatField(required=False)
    max = serializers.FloatField(required=False)
    dataFilter = serializers.ChoiceField(choices=DATA_FILTERS, required=False)

    def validate(self, data):
        if "min" in data and "max" in data and data["min"] > data["max"]:
            raise serializers.ValidationError("min cannot be greater than max.")
        return data

    def validate_span(self, span: str) -> Span:
        try:
            return Span.from_str(span)
        except ValueError as e:
            raise serializers.ValidationError(str(e))


@region_silo_endpoint
class OrganizationEventsSpansHistogramEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def has_feature(self, organization, request):
        return features.has(
            "organizations:performance-span-histogram-view", organization, actor=request.user
        )

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({})

        with sentry_sdk.start_span(op="discover.endpoint", description="spans_histogram"):
            serializer = SpansHistogramSerializer(data=request.GET)
            if serializer.is_valid():
                data = serializer.validated_data

                with self.handle_query_errors():
                    results = discover.spans_histogram_query(
                        data["span"],
                        data.get("query"),
                        params,
                        data["numBuckets"],
                        data["precision"],
                        min_value=data.get("min"),
                        max_value=data.get("max"),
                        data_filter=data.get("dataFilter"),
                        referrer="api.organization-events-spans-histogram",
                    )

                return Response(results)
            else:
                return Response(serializer.errors, status=400)
