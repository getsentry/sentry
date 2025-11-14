from typing import int
import logging
from collections import defaultdict

from drf_spectacular.utils import extend_schema
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest, TimeSeriesResponse
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    Function,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsArgsDict, StatsMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.uptime.endpoints.utils import (
    MAX_UPTIME_SUBSCRIPTION_IDS,
    authorize_and_map_uptime_detector_subscription_ids,
)
from sentry.uptime.types import IncidentStatus
from sentry.utils.snuba_rpc import timeseries_rpc

logger = logging.getLogger(__name__)


@region_silo_endpoint
@extend_schema(tags=["Uptime Monitors"])
class OrganizationUptimeStatsEndpoint(OrganizationEndpoint, StatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS
    permission_classes = (OrganizationPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        timerange_args = self._parse_args(request, restrict_rollups=False)
        projects = self.get_projects(request, organization, include_all_accessible=True)

        uptime_detector_ids = request.GET.getlist("uptimeDetectorId")

        if not uptime_detector_ids:
            return self.respond(
                "Uptime detector ids must be provided",
                status=400,
            )

        if len(uptime_detector_ids) > MAX_UPTIME_SUBSCRIPTION_IDS:
            return self.respond(
                f"Too many uptime detector ids provided. Maximum is {MAX_UPTIME_SUBSCRIPTION_IDS}",
                status=400,
            )

        try:
            subscription_id_to_id_mapping, subscription_ids = (
                authorize_and_map_uptime_detector_subscription_ids(uptime_detector_ids, projects)
            )
        except ValueError:
            return self.respond("Invalid uptime detector ids provided", status=400)

        try:
            eap_response = self._make_eap_request(
                organization,
                projects,
                subscription_ids,
                timerange_args,
            )
            formatted_response = self._format_response(eap_response)
        except Exception:
            logger.exception("Error making EAP RPC request for uptime check stats")
            return self.respond("error making request", status=400)

        # Map the response back to the original detector IDs
        mapped_response = self._map_response_to_original_ids(
            subscription_id_to_id_mapping, formatted_response
        )

        return self.respond(mapped_response)

    def _make_eap_request(
        self,
        organization: Organization,
        projects: list[Project],
        subscription_ids: list[str],
        timerange_args: StatsArgsDict,
    ) -> TimeSeriesResponse:

        eap_query_start = timerange_args["start"]
        start_timestamp = Timestamp()
        start_timestamp.FromDatetime(eap_query_start)
        end_timestamp = Timestamp()
        end_timestamp.FromDatetime(timerange_args["end"])

        subscription_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(
                    name="subscription_id",
                    type=AttributeKey.Type.TYPE_STRING,
                ),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_str_array=StrArray(values=subscription_ids)),
            )
        )

        request_sequence_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(
                    name="request_sequence",
                    type=AttributeKey.Type.TYPE_INT,
                ),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_int=0),
            )
        )
        query_filter = TraceItemFilter(
            and_filter=AndFilter(filters=[subscription_filter, request_sequence_filter])
        )

        request = TimeSeriesRequest(
            meta=RequestMeta(
                organization_id=organization.id,
                project_ids=[project.id for project in projects],
                trace_item_type=TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
                downsampled_storage_config=DownsampledStorageConfig(
                    mode=DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
                ),
            ),
            aggregations=[
                AttributeAggregation(
                    aggregate=Function.FUNCTION_COUNT,
                    key=AttributeKey(
                        name="guid",
                        type=AttributeKey.Type.TYPE_STRING,
                    ),
                    label="count()",
                )
            ],
            group_by=[
                AttributeKey(
                    name="subscription_id",
                    type=AttributeKey.Type.TYPE_STRING,
                ),
                AttributeKey(
                    name="check_status",
                    type=AttributeKey.Type.TYPE_STRING,
                ),
                AttributeKey(
                    name="incident_status",
                    type=AttributeKey.Type.TYPE_INT,
                ),
            ],
            granularity_secs=timerange_args["rollup"],
            filter=query_filter,
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

        Args:
            response: The EAP RPC TimeSeriesResponse
            subscription_key: The attribute name for subscription ID ("uptime_subscription_id" or "subscription_id")
            epoch_cutoff: Optional cutoff timestamp for data
        """
        formatted_data: dict[str, dict[int, dict[str, int]]] = {}

        for timeseries in response.result_timeseries:
            subscription_id = timeseries.group_by_attributes["subscription_id"]
            status = timeseries.group_by_attributes["check_status"]
            incident_status = timeseries.group_by_attributes["incident_status"]

            if status == "failure" and incident_status == str(IncidentStatus.IN_INCIDENT.value):
                status = "failure_incident"

            if subscription_id not in formatted_data:
                formatted_data[subscription_id] = defaultdict(
                    lambda: {"failure": 0, "failure_incident": 0, "success": 0, "missed_window": 0}
                )

            for bucket, data_point in zip(timeseries.buckets, timeseries.data_points):
                value = int(data_point.data) if data_point.data_present else 0
                # Add to existing value instead of overwriting, since multiple timeseries
                # may contribute to the same status (e.g., success with different incident_status values)
                formatted_data[subscription_id][bucket.seconds][status] += value

        final_data: dict[str, list[tuple[int, dict[str, int]]]] = {}
        for subscription_id, timestamps in formatted_data.items():
            final_data[subscription_id] = [
                (ts, counts) for ts, counts in sorted(timestamps.items())
            ]

        return final_data

    def _map_response_to_original_ids(
        self,
        subscription_id_to_original_id: dict[str, int],
        formatted_response: dict[str, list[tuple[int, dict[str, int]]]],
    ) -> dict[int, list[tuple[int, dict[str, int]]]]:
        """
        Map the response back to the original detector IDs
        """
        return {
            subscription_id_to_original_id[subscription_id]: data
            for subscription_id, data in formatted_response.items()
        }
