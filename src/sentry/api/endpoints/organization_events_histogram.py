import sentry_sdk
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.snuba import discover

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


class OrganizationEventsHistogramEndpoint(OrganizationEventsV2EndpointBase):
    def has_feature(self, organization, request):
        return features.has("organizations:performance-view", organization, actor=request.user)

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({})

        with sentry_sdk.start_span(op="discover.endpoint", description="histogram"):
            serializer = HistogramSerializer(data=request.GET)
            if serializer.is_valid():
                data = serializer.validated_data

                with self.handle_query_errors():
                    results = discover.histogram_query(
                        data["field"],
                        data.get("query"),
                        params,
                        data["numBuckets"],
                        data["precision"],
                        min_value=data.get("min"),
                        max_value=data.get("max"),
                        data_filter=data.get("dataFilter"),
                        referrer="api.organization-events-histogram",
                    )

                return Response(results)
            else:
                return Response(serializer.errors, status=400)
