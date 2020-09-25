from __future__ import absolute_import

from collections import namedtuple
from math import ceil, floor

import sentry_sdk

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.event_search import get_function_alias
from sentry.snuba import discover
from sentry.utils.snuba import is_measurement


HistogramParams = namedtuple(
    "HistogramParams", ["num_buckets", "bucket_size", "start_offset", "multiplier"]
)


def get_histogram_col(params):
    return u"measurements_histogram({:g}, {:.0f}, {:.0f}, {:.0f})".format(*params)


ARRAY_JOIN_MEASUREMENTS_KEY = "array_join(measurements_key)"


class OrganizationEventsMeasurementsHistogramEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        try:
            num_buckets = int(request.GET.get("num_buckets", 10))
        except ValueError:
            raise ParseError(u"Invalid number of buckets specified.")

        query = request.GET.get("query")
        measurements = request.GET.getlist("measurement")

        # this precision parameter can be exposed to control the number
        # of decimal places of precision we desire in the histogram bins
        precision = 0

        with sentry_sdk.start_span(
            op="discover.endpoint", description="measurements_histogram"
        ) as span:
            span.set_tag("organization", organization)

            histogram_params = self.find_histogram_params(
                num_buckets,
                precision,
                self.normalize_measurement_names(measurements),
                params,
                query,
            )
            # histogram_col_format = u"measurements_histogram({:g}, {:.0f}, {:.0f}, {:.0f})"
            # histogram_col = histogram_col_format.format(*histogram_params)
            histogram_col = get_histogram_col(histogram_params)

            key_col = ARRAY_JOIN_MEASUREMENTS_KEY
            key_snuba_name = get_function_alias(key_col)

            selected_columns = [key_col, histogram_col, "count()"]

            def data_fn(offset, limit):
                return discover.query(
                    selected_columns=selected_columns,
                    conditions=[[key_snuba_name, "IN", measurements]],
                    query=query,
                    params=params,
                    # the zerofill step assumes its order by the bin then name
                    orderby=[get_function_alias(histogram_col), key_snuba_name],
                    offset=offset,
                    limit=limit,
                    referrer=request.GET.get(
                        "referrer", "api.organization-events-measurements-histogram"
                    ),
                    auto_fields=True,
                    use_aggregate_conditions=True,
                )

            with self.handle_query_errors():
                return self.paginate(
                    request=request,
                    paginator=GenericOffsetPaginator(data_fn=data_fn),
                    on_results=lambda results: self.handle_results(
                        request,
                        organization,
                        params["project_id"],
                        measurements,
                        histogram_params,
                        results,
                    ),
                    # # of results is equal to # of measurements X # of buckets
                    default_per_page=len(measurements) * histogram_params.num_buckets,
                    max_per_page=200,
                )

    def find_histogram_params(self, num_buckets, precision, measurements, params, query):
        measurements_min, measurements_max = self.find_min_max(measurements, params, query)

        # finding the bounds might result in None if there isn't sufficient data
        if measurements_min is None or measurements_max is None:
            return HistogramParams(1, 1, 0, 1)

        multiplier = int(10 ** precision)

        bucket_size = int(
            ceil(multiplier * (measurements_max - measurements_min) / float(num_buckets))
        )
        if bucket_size == 0:
            bucket_size = 1

        # Determine the first bucket that will show up in
        # our results so that we can zerofill correctly.
        start_offset = int(floor(measurements_min / bucket_size) * bucket_size)

        return HistogramParams(num_buckets, bucket_size, start_offset, multiplier)

    def handle_results(
        self, request, organization, project_ids, measurements, histogram_params, results
    ):
        results = self.zerofill_and_adjust_results(request, measurements, histogram_params, results)
        return self.handle_results_with_meta(request, organization, project_ids, results)

    def zerofill_and_adjust_histograms(self, measurements, histogram_params, results):
        with sentry_sdk.start_span(
            op="discover.endpoint", description="measurements_histogram_zerofill"
        ):
            data = results["data"]

            if len(data) == len(measurements) * histogram_params.num_buckets:
                return results

            measurements_name = get_function_alias(ARRAY_JOIN_MEASUREMENTS_KEY)
            measurements_bin = get_function_alias(get_histogram_col(histogram_params))

            measurements = sorted(measurements)

            new_data = []

            idx = 0
            for i in range(histogram_params.num_buckets):
                bucket = histogram_params.start_offset + histogram_params.bucket_size * i
                for measurement in measurements:
                    if (
                        idx >= len(data)
                        or data[idx][measurements_name] != measurement
                        or data[idx][measurements_bin] != bucket
                    ):
                        new_data.append(
                            {measurements_name: measurement, measurements_bin: bucket, "count": 0}
                        )
                    else:
                        new_data.append(data[idx])
                        idx += 1

                    if histogram_params.multiplier > 1:
                        new_data[-1][measurements_bin] /= float(histogram_params.multiplier)

            # at this point idx == len(data)

            results["data"] = new_data

            return results

    def normalize_measurement_names(self, measurements):
        formatted_measurements = []

        for key in measurements:
            measurement = u"measurements.{}".format(key)

            if not is_measurement(measurement):
                raise ParseError(u"{} is not a valid measurement.".format(key))

            formatted_measurements.append(measurement)

        return formatted_measurements

    def find_min_max(self, measurements, params, query):
        with sentry_sdk.start_span(
            op="discover.endpoint", description="measurements_histogram_min_max"
        ):
            min_columns, max_columns = [], []
            for measurement in measurements:
                min_columns.append("min({})".format(measurement))
                max_columns.append("max({})".format(measurement))

            meta_results = discover.query(
                selected_columns=min_columns + max_columns,
                query=query,
                params=params,
                limit=1,
                referrer="api.organization-events-measurements-min-max",
                auto_fields=True,
                use_aggregate_conditions=True,
            )
            # there should be exactly 1 row in the results
            data = meta_results["data"][0]

            measurements_min = None
            for min_column in min_columns:
                value = data[get_function_alias(min_column)]
                if value is None:
                    continue
                if measurements_min is None or value < measurements_min:
                    measurements_min = value

            measurements_max = None
            for max_column in max_columns:
                value = data[get_function_alias(max_column)]
                if value is None:
                    continue
                if measurements_max is None or value > measurements_max:
                    measurements_max = value

            return measurements_min, measurements_max
