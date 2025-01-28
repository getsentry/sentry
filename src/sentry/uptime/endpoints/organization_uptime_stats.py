import logging
from collections import defaultdict

from drf_spectacular.utils import extend_schema
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest, TimeSeriesResponse
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    Function,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsArgsDict, StatsMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.uptime.models import ProjectUptimeSubscription
from sentry.utils.snuba_rpc import timeseries_rpc

logger = logging.getLogger(__name__)


MAX_UPTIME_SUBSCRIPTION_IDS = 100


@region_silo_endpoint
@extend_schema(tags=["Uptime Monitors"])
class OrganizationUptimeStatsEndpoint(OrganizationEndpoint, StatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS
    permission_classes = (OrganizationPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        timerange_args = self._parse_args(request)
        projects = self.get_projects(request, organization)

        uptime_subscription_ids = request.GET.getlist("uptime_subscription_id")

        if not uptime_subscription_ids:
            return self.respond("No uptime subscription ids provided", status=400)

        if len(uptime_subscription_ids) > MAX_UPTIME_SUBSCRIPTION_IDS:
            return self.respond(
                f"Too many uptime subscription ids provided. Maximum is {MAX_UPTIME_SUBSCRIPTION_IDS}",
                status=400,
            )

        try:
            self._authorize_uptime_subscription_ids(uptime_subscription_ids, projects)
        except ValueError:
            return self.respond("Invalid uptime subscription ids provided", status=400)

        try:
            eap_response = self._make_eap_request(
                organization, projects, uptime_subscription_ids, timerange_args
            )
        except Exception:
            logger.exception("Error making EAP RPC request for uptime check stats")
            return self.respond("error making request", status=400)

        formatted_response = self._format_response(eap_response)

        return self.respond(formatted_response)

    def _authorize_uptime_subscription_ids(
        self, uptime_subscription_ids: list[str], projects: list[Project]
    ) -> None:

        valid_subscription_ids = ProjectUptimeSubscription.objects.filter(
            project_id__in=[project.id for project in projects],
            uptime_subscription__subscription_id__in=uptime_subscription_ids,
        ).values_list("uptime_subscription__subscription_id", flat=True)

        if set(uptime_subscription_ids) != set(valid_subscription_ids):
            raise ValueError("Invalid uptime subscription ids provided")

    def _make_eap_request(
        self,
        organization: Organization,
        projects: list[Project],
        uptime_subscription_ids: list[str],
        timerange_args: StatsArgsDict,
    ) -> TimeSeriesResponse:
        start_timestamp = Timestamp()
        start_timestamp.FromDatetime(timerange_args["start"])
        end_timestamp = Timestamp()
        end_timestamp.FromDatetime(timerange_args["end"])
        request = TimeSeriesRequest(
            meta=RequestMeta(
                organization_id=organization.id,
                project_ids=[project.id for project in projects],
                trace_item_type=TraceItemType.TRACE_ITEM_TYPE_UPTIME_CHECK,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
            ),
            aggregations=[
                AttributeAggregation(
                    aggregate=Function.FUNCTION_COUNT,
                    key=AttributeKey(
                        name="uptime_check_id",
                        type=AttributeKey.Type.TYPE_STRING,
                    ),
                    label="count()",
                )
            ],
            group_by=[
                AttributeKey(
                    name="uptime_subscription_id",
                    type=AttributeKey.Type.TYPE_STRING,
                ),
                AttributeKey(
                    name="check_status",
                    type=AttributeKey.Type.TYPE_STRING,
                ),
            ],
            granularity_secs=timerange_args["rollup"],
            filter=TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(
                        name="uptime_subscription_id",
                        type=AttributeKey.Type.TYPE_STRING,
                    ),
                    op=ComparisonFilter.OP_IN,
                    value=AttributeValue(val_str_array=StrArray(values=uptime_subscription_ids)),
                )
            ),
        )
        responses = timeseries_rpc([request])
        assert len(responses) == 1
        return responses[0]

    def _format_response(
        self, response: TimeSeriesResponse
    ) -> dict[str, list[tuple[int, dict[str, int]]]]:
        """
        Formats the response from the EAP RPC request into a dictionary of subscription ids to a list of tuples
        of timestamps and a dictionary of check statuses to counts.
        """
        formatted_data: dict[str, dict[int, dict[str, int]]] = {}

        for timeseries in response.result_timeseries:
            subscription_id = timeseries.group_by_attributes["uptime_subscription_id"]
            status = timeseries.group_by_attributes["check_status"]

            if subscription_id not in formatted_data:
                formatted_data[subscription_id] = defaultdict(
                    lambda: {"failure": 0, "success": 0, "missed_window": 0}
                )

            for bucket, data_point in zip(timeseries.buckets, timeseries.data_points):
                value = int(data_point.data) if data_point.data_present else 0
                formatted_data[subscription_id][bucket.seconds][status] = value

        final_data: dict[str, list[tuple[int, dict[str, int]]]] = {}
        for subscription_id, timestamps in formatted_data.items():
            final_data[subscription_id] = [
                (ts, counts) for ts, counts in sorted(timestamps.items())
            ]

        return final_data
