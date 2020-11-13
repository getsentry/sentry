from __future__ import absolute_import

import sentry_sdk

from sentry import features
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.snuba import discover

# The maximum number of measurements allowed to be queried at at time
MAX_MEASUREMENTS = 4

DATA_FILTERS = ["all", "exclude_outliers"]


class MeasurementsHistogramSerializer(serializers.Serializer):
    query = serializers.CharField(required=False)
    measurement = serializers.ListField(allow_empty=False, max_length=MAX_MEASUREMENTS)
    numBuckets = serializers.IntegerField(min_value=1, max_value=100)
    precision = serializers.IntegerField(default=0, min_value=0, max_value=4)
    min = serializers.FloatField(required=False)
    max = serializers.FloatField(required=False)
    dataFilter = serializers.ChoiceField(choices=DATA_FILTERS, required=False)


class OrganizationEventsMeasurementsHistogramEndpoint(OrganizationEventsV2EndpointBase):
    def has_feature(self, organization, request):
        return features.has("organizations:performance-view", organization, actor=request.user)

    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        with sentry_sdk.start_span(op="discover.endpoint", description="measurements_histogram"):
            serializer = MeasurementsHistogramSerializer(data=request.GET)
            if serializer.is_valid():
                data = serializer.validated_data

                with self.handle_query_errors():
                    results = discover.measurements_histogram_query(
                        data["measurement"],
                        data.get("query"),
                        params,
                        data["numBuckets"],
                        data["precision"],
                        data.get("min"),
                        data.get("max"),
                        data.get("dataFilter"),
                        "api.organization-events-measurements-histogram",
                    )

                results_with_meta = self.handle_results_with_meta(
                    request, organization, params["project_id"], results
                )

                return Response(results_with_meta)
            else:
                return Response(serializer.errors, status=400)
