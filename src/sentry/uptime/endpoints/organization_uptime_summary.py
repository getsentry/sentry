from typing import int
import logging
from datetime import datetime

from drf_spectacular.utils import extend_schema
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_MISSED_WINDOW,
)
from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
    TraceItemTableResponse,
)
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
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.uptime.endpoints.utils import (
    MAX_UPTIME_SUBSCRIPTION_IDS,
    authorize_and_map_uptime_detector_subscription_ids,
)
from sentry.uptime.types import IncidentStatus, UptimeSummary
from sentry.utils.snuba_rpc import table_rpc

logger = logging.getLogger(__name__)


@region_silo_endpoint
@extend_schema(tags=["Uptime Monitors"])
class OrganizationUptimeSummaryEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS
    permission_classes = (OrganizationPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        start, end = get_date_range_from_params(request.GET)
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
            subscription_id_to_original_id, subscription_ids = (
                authorize_and_map_uptime_detector_subscription_ids(uptime_detector_ids, projects)
            )
        except ValueError:
            return self.respond("Invalid uptime detector ids provided", status=400)

        try:
            eap_response = self._make_eap_request(
                organization,
                projects,
                subscription_ids,
                start,
                end,
            )
            formatted_response = self._format_response(eap_response)
        except Exception:
            logger.exception("Error making EAP RPC request for uptime check summary")
            return self.respond("error making request", status=400)

        # Map the response back to the original detector IDs
        mapped_response = self._map_response_to_original_ids(
            subscription_id_to_original_id, formatted_response
        )

        # Serialize the UptimeSummary objects
        serialized_response = {
            project_id: serialize(stats, request.user)
            for project_id, stats in mapped_response.items()
        }

        return self.respond(serialized_response)

    def _make_eap_request(
        self,
        organization: Organization,
        projects: list[Project],
        subscription_ids: list[str],
        start: datetime,
        end: datetime,
    ) -> TraceItemTableResponse:
        start_timestamp = Timestamp()
        start_timestamp.FromDatetime(start)
        end_timestamp = Timestamp()
        end_timestamp.FromDatetime(end)

        subscription_attribute_key = AttributeKey(
            name="subscription_id",
            type=AttributeKey.Type.TYPE_STRING,
        )

        query_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=subscription_attribute_key,
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_str_array=StrArray(values=subscription_ids)),
            )
        )

        def failure_filter(incident_status: IncidentStatus) -> TraceItemFilter:
            status_filter = TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name="check_status", type=AttributeKey.Type.TYPE_STRING),
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(val_str=CHECKSTATUS_FAILURE),
                )
            )
            incident_filter = TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name="incident_status", type=AttributeKey.Type.TYPE_INT),
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(val_int=incident_status.value),
                )
            )
            return TraceItemFilter(and_filter=AndFilter(filters=[status_filter, incident_filter]))

        columns: list[Column] = [
            Column(label="uptime_subscription_id", key=subscription_attribute_key),
            Column(
                label="total_checks",
                aggregation=AttributeAggregation(
                    aggregate=Function.FUNCTION_COUNT,
                    key=subscription_attribute_key,
                    label="count()",
                ),
            ),
            Column(
                label="failed_checks",
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=Function.FUNCTION_COUNT,
                    key=subscription_attribute_key,
                    filter=failure_filter(incident_status=IncidentStatus.NO_INCIDENT),
                ),
            ),
            Column(
                label="downtime_checks",
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=Function.FUNCTION_COUNT,
                    key=subscription_attribute_key,
                    filter=failure_filter(incident_status=IncidentStatus.IN_INCIDENT),
                ),
            ),
            Column(
                label="missed_window_checks",
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=Function.FUNCTION_COUNT,
                    key=subscription_attribute_key,
                    filter=TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="check_status", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str=CHECKSTATUS_MISSED_WINDOW),
                        )
                    ),
                ),
            ),
            Column(
                label="avg_duration_us",
                aggregation=AttributeAggregation(
                    aggregate=Function.FUNCTION_AVG,
                    key=AttributeKey(name="check_duration_us", type=AttributeKey.Type.TYPE_INT),
                    label="avg(check_duration_us)",
                ),
            ),
        ]

        request = TraceItemTableRequest(
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
            group_by=[subscription_attribute_key],
            filter=query_filter,
            columns=columns,
        )
        responses = table_rpc([request])
        assert len(responses) == 1
        return responses[0]

    def _format_response(self, response: TraceItemTableResponse) -> dict[str, UptimeSummary]:
        """
        Formats the response from the EAP RPC request into a dictionary mapping
        subscription ids to UptimeSummary
        """
        column_values = response.column_values
        column_names = [cv.attribute_name for cv in column_values]
        formatted_data: dict[str, UptimeSummary] = {}

        if not column_values:
            return {}

        for row_idx in range(len(column_values[0].results)):
            row_dict: dict[str, AttributeValue] = {
                col_name: column_values[col_idx].results[row_idx]
                for col_idx, col_name in enumerate(column_names)
            }

            summary_stats = UptimeSummary(
                total_checks=int(row_dict["total_checks"].val_double),
                failed_checks=int(row_dict["failed_checks"].val_double),
                downtime_checks=int(row_dict["downtime_checks"].val_double),
                missed_window_checks=int(row_dict["missed_window_checks"].val_double),
                avg_duration_us=row_dict["avg_duration_us"].val_double,
            )

            subscription_id = row_dict["uptime_subscription_id"].val_str
            formatted_data[subscription_id] = summary_stats

        return formatted_data

    def _map_response_to_original_ids(
        self,
        subscription_id_to_original_id: dict[str, int],
        formatted_response: dict[str, UptimeSummary],
    ) -> dict[int, UptimeSummary]:
        """
        Map the response back to the original detector IDs
        """
        return {
            subscription_id_to_original_id[subscription_id]: data
            for subscription_id, data in formatted_response.items()
        }
