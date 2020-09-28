from __future__ import absolute_import

import sentry_sdk

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.snuba import discover

# The maximum number of measurements allowed to be queried at at time
MAX_MEASUREMENTS = 4


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
            raise ParseError(detail=u"Missing value for measurements.")
        if len(measurements) > MAX_MEASUREMENTS:
            raise ParseError(
                detail=u"Too many measurements specified, maximum allowed is {}.".format(
                    MAX_MEASUREMENTS
                )
            )

        with sentry_sdk.start_span(
            op="discover.endpoint", description="measurements_histogram"
        ) as span:
            span.set_tag("organization", organization)

            results = discover.measurements_histogram_query(
                measurements,
                request.GET.get("query"),
                params,
                self.get_int_param(request, "numBuckets", minimum=1),
                self.get_int_param(request, "min", allow_none=True),
                self.get_int_param(request, "max", allow_none=True),
                # don't allow for too many decimal places of precision
                self.get_int_param(request, "precision", default=0, minimum=0, maximum=4),
                "api.organization-events-measurements-histogram",
            )

            results_with_meta = self.handle_results_with_meta(
                request, organization, params["project_id"], results
            )

            return Response(results_with_meta)

    def get_int_param(
        self, request, param, allow_none=False, default=None, minimum=None, maximum=None
    ):
        raw_value = request.GET.get(param, default)

        try:
            if raw_value is not None:
                value = int(raw_value)
                if (minimum is None or minimum <= value) and (maximum is None or maximum >= value):
                    return value
            elif not allow_none:
                raise ParseError(detail=u"Missing value for {}.".format(param))
            else:
                return None
        except ValueError:
            # let this fall through and do all the error handling outside of the try except block
            pass

        if minimum is not None and maximum is not None:
            raise ParseError(
                detail=u"Invalid value for {}. Expected to be between {} and {} got {}".format(
                    param, minimum, maximum, raw_value
                )
            )
        elif minimum is not None:
            raise ParseError(
                detail=u"Invalid value for {}. Expected to be at least {} got {}.".format(
                    param, minimum, raw_value
                )
            )
        elif maximum is not None:
            raise ParseError(
                detail=u"Invalid value for {}. Expected to be at most {} got {}.".format(
                    param, maximum, raw_value
                )
            )
        else:
            raise ParseError(
                detail=u"Invalid value for {}. Expected to be an integer got {}.".format(
                    param, raw_value
                )
            )
