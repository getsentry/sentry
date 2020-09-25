from __future__ import absolute_import

from collections import namedtuple

import sentry_sdk

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.snuba import discover


HistogramParams = namedtuple(
    "HistogramParams", ["num_buckets", "bucket_size", "start_offset", "multiplier"]
)


def get_histogram_col(params):
    return u"measurements_histogram({:d}, {:d}, {:d}, {:d})".format(*params)


KEY_COL = "array_join(measurements_key)"


class OrganizationEventsMeasurementsHistogramEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        measurements = request.GET.getlist("measurement")
        if not measurements:
            raise ParseError(u"No measurements specified")

        query = request.GET.get("query")

        try:
            num_buckets = int(request.GET.get("num_buckets"))
        except ValueError:
            raise ParseError(u"Invalid number of buckets specified.")

        try:
            min_value = request.GET.get("min")
            if min_value is not None:
                min_value = int(min_value)
        except ValueError:
            raise ParseError(u"Invalid minimum specified.")

        try:
            max_value = request.GET.get("max")
            if max_value is not None:
                max_value = int(max_value)
        except ValueError:
            raise ParseError(u"Invalid maximum specified.")

        try:
            precision = int(request.GET.get("precision", 0))
        except ValueError:
            raise ParseError(u"Invalid precision specified.")

        with sentry_sdk.start_span(
            op="discover.endpoint", description="measurements_histogram"
        ) as span:
            span.set_tag("organization", organization)

            results = discover.measurements_histogram_query(
                measurements,
                query,
                params,
                num_buckets,
                min_value,
                max_value,
                precision,
                "api.organization-events-measurements-histogram",
            )

            results_with_meta = self.handle_results_with_meta(
                request, organization, params["project_id"], results
            )

            return Response(results_with_meta)
