from __future__ import absolute_import

import sentry_sdk

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.snuba import discover

# The maximum number of measurements allowed to be queried at at time
MAX_MEASUREMENTS = 4


class MeasurementsHistogramSerializer(serializers.Serializer):
    num_buckets = serializers.IntegerField(min_value=1)
    precision = serializers.IntegerField(default=0, min_value=0, max_value=4)
    measurement = serializers.ListField(allow_empty=False, max_length=4)
    min = serializers.IntegerField(required=False)
    max = serializers.IntegerField(required=False)


class OrganizationEventsMeasurementsHistogramEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        with sentry_sdk.start_span(
            op="discover.endpoint", description="measurements_histogram"
        ) as span:
            span.set_tag("organization", organization)

            serializer = MeasurementsHistogramSerializer(data=request.GET)
            if serializer.is_valid():
                data = serializer.validated_data

                results = discover.measurements_histogram_query(
                    data["measurement"],
                    request.GET.get("query"),
                    params,
                    data["num_buckets"],
                    data["precision"],
                    data.get("min"),
                    data.get("max"),
                    "api.organization-events-measurements-histogram",
                )

                results_with_meta = self.handle_results_with_meta(
                    request, organization, params["project_id"], results
                )

                return Response(results_with_meta)
            else:
                return Response(serializer.errors, status=400)
