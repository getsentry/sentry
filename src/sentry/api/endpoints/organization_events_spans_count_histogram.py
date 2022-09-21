import sentry_sdk
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.snuba import discover

DATA_FILTERS = ["all", "exclude_outliers"]


class SpansCountHistogramSerializer(serializers.Serializer):
    spanOp = serializers.CharField(required=True, allow_null=False)
    query = serializers.CharField(required=False)
    numBuckets = serializers.IntegerField(min_value=1, max_value=100)
    precision = serializers.IntegerField(default=0, min_value=0, max_value=4)
    min = serializers.FloatField(required=False)
    max = serializers.FloatField(required=False)
    dataFilter = serializers.ChoiceField(choices=DATA_FILTERS, required=False)

    def validate(self, data):
        if "min" in data and "max" in data and data["min"] >= data["max"]:
            raise serializers.ValidationError("min must be less than max.")
        return data

    def validate_spanOp(self, spanOp: str):
        if spanOp == "":
            raise serializers.ValidationError("span op cannot be empty.")
        return spanOp


@region_silo_endpoint
class OrganizationEventsSpansCountHistogramEndpoint(OrganizationEventsV2EndpointBase):
    private = True

    def has_feature(self, organization, request):
        return features.has("organizations:performance-issues", organization, actor=request.user)

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({})

        with sentry_sdk.start_span(op="discover.endpoint", description="spans_count_histogram"):
            serializer = SpansCountHistogramSerializer(data=request.GET)
            if serializer.is_valid():
                data = serializer.validated_data
                span_op = data["spanOp"]

                with self.handle_query_errors():
                    results = discover.span_count_histogram_query(
                        span_op,
                        data.get("query"),
                        params,
                        data["numBuckets"],
                        data["precision"],
                        min_value=data.get("min"),
                        max_value=data.get("max"),
                        data_filter=data.get("dataFilter"),
                        referrer="api.organization-events-spans-count-histogram",
                    )

                return Response(results)
            else:
                return Response(serializer.errors, status=400)
