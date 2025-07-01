import logging
import uuid
from datetime import datetime, timezone
from typing import Any, cast

from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_kafka_schemas.schema_types.snuba_uptime_results_v1 import (
    CheckStatus,
    CheckStatusReasonType,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.api.utils import get_date_range_from_params, handle_query_errors
from sentry.models.project import Project
from sentry.uptime.endpoints.bases import ProjectUptimeAlertEndpoint
from sentry.uptime.endpoints.serializers import EapCheckEntrySerializerResponse
from sentry.uptime.models import ProjectUptimeSubscription
from sentry.uptime.types import EapCheckEntry, IncidentStatus
from sentry.utils import snuba_rpc

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectUptimeAlertCheckIndexEndpoint(ProjectUptimeAlertEndpoint):
    owner = ApiOwner.CRONS

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        request: Request,
        project: Project,
        uptime_subscription: ProjectUptimeSubscription,
    ) -> Response:

        if uptime_subscription.uptime_subscription.subscription_id is None:
            return Response([])

        start, end = get_date_range_from_params(request.GET)

        def data_fn(offset: int, limit: int) -> Any:
            try:
                if features.has(
                    "organizations:uptime-eap-uptime-results-query", project.organization
                ):
                    return self._make_eap_request(
                        project,
                        uptime_subscription,
                        offset,
                        limit,
                        start,
                        end,
                        TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
                        "subscription_id",
                        True,
                    )
                else:
                    return self._make_eap_request(
                        project,
                        uptime_subscription,
                        offset,
                        limit,
                        start,
                        end,
                        TraceItemType.TRACE_ITEM_TYPE_UPTIME_CHECK,
                        "uptime_subscription_id",
                        False,
                    )
            except Exception:
                logger.exception("Error making EAP RPC request for uptime alert checks")
                return []

        with handle_query_errors():
            return self.paginate(
                request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                default_per_page=10,
                max_per_page=100,
            )

    def _make_eap_request(
        self,
        project: Project,
        uptime_subscription: ProjectUptimeSubscription,
        offset: int,
        limit: int,
        start: datetime,
        end: datetime,
        trace_item_type: TraceItemType.ValueType,
        subscription_key: str,
        include_request_sequence_filter: bool,
    ) -> list[EapCheckEntrySerializerResponse]:
        maybe_cutoff = self._get_date_cutoff_epoch_seconds()
        epoch_cutoff = (
            datetime.fromtimestamp(maybe_cutoff, tz=timezone.utc) if maybe_cutoff else None
        )
        if epoch_cutoff and epoch_cutoff > start:
            start = epoch_cutoff

        start_timestamp = Timestamp()
        start_timestamp.FromDatetime(start)
        end_timestamp = Timestamp()
        end_timestamp.FromDatetime(end)
        subscription_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(
                    name=subscription_key,
                    type=AttributeKey.Type.TYPE_STRING,
                ),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(
                    val_str=str(uuid.UUID(uptime_subscription.uptime_subscription.subscription_id))
                ),
            )
        )

        if include_request_sequence_filter:
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
        else:
            query_filter = subscription_filter

        rpc_request = TraceItemTableRequest(
            meta=RequestMeta(
                referrer="uptime_alert_checks_index",
                organization_id=project.organization.id,
                project_ids=[project.id],
                trace_item_type=trace_item_type,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
            ),
            filter=query_filter,
            columns=self._get_columns_for_trace_item_type(trace_item_type),
            order_by=[
                TraceItemTableRequest.OrderBy(
                    column=Column(
                        label="timestamp",
                        key=AttributeKey(
                            name=(
                                "sentry.timestamp"
                                if trace_item_type == TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT
                                else "timestamp"
                            ),
                            type=AttributeKey.Type.TYPE_DOUBLE,
                        ),
                    ),
                    descending=True,
                )
            ],
            limit=limit,
            page_token=PageToken(offset=offset),
        )

        rpc_response = snuba_rpc.table_rpc([rpc_request])[0]
        return self._serialize_response(rpc_response, uptime_subscription, trace_item_type)

    def _get_columns_for_trace_item_type(
        self, trace_item_type: TraceItemType.ValueType
    ) -> list[Column]:
        """Get appropriate columns based on trace item type."""
        common_columns = [
            Column(
                label="environment",
                key=AttributeKey(name="environment", type=AttributeKey.Type.TYPE_STRING),
            ),
            Column(
                label="timestamp",
                key=AttributeKey(
                    name=(
                        "sentry.timestamp"
                        if trace_item_type == TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT
                        else "timestamp"
                    ),
                    type=AttributeKey.Type.TYPE_DOUBLE,
                ),
            ),
            Column(
                label="region",
                key=AttributeKey(name="region", type=AttributeKey.Type.TYPE_STRING),
            ),
            Column(
                label="check_status",
                key=AttributeKey(name="check_status", type=AttributeKey.Type.TYPE_STRING),
            ),
            Column(
                label="http_status_code",
                key=AttributeKey(name="http_status_code", type=AttributeKey.Type.TYPE_INT),
            ),
            Column(
                label="incident_status",
                key=AttributeKey(name="incident_status", type=AttributeKey.Type.TYPE_INT),
            ),
            Column(
                label="trace_id",
                key=AttributeKey(name="trace_id", type=AttributeKey.Type.TYPE_STRING),
            ),
        ]

        if trace_item_type == TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT:
            return common_columns + [
                Column(
                    label="subscription_id",
                    key=AttributeKey(name="subscription_id", type=AttributeKey.Type.TYPE_STRING),
                ),
                Column(
                    label="check_id",
                    key=AttributeKey(name="check_id", type=AttributeKey.Type.TYPE_STRING),
                ),
                Column(
                    label="scheduled_check_time_us",
                    key=AttributeKey(
                        name="scheduled_check_time_us", type=AttributeKey.Type.TYPE_INT
                    ),
                ),
                Column(
                    label="check_duration_us",
                    key=AttributeKey(name="check_duration_us", type=AttributeKey.Type.TYPE_INT),
                ),
                Column(
                    label="check_status_reason",
                    key=AttributeKey(name="status_reason_type", type=AttributeKey.Type.TYPE_STRING),
                ),
                Column(
                    label="guid",
                    key=AttributeKey(name="guid", type=AttributeKey.Type.TYPE_STRING),
                ),
            ]
        else:
            return common_columns + [
                Column(
                    label="uptime_subscription_id",
                    key=AttributeKey(
                        name="uptime_subscription_id", type=AttributeKey.Type.TYPE_STRING
                    ),
                ),
                Column(
                    label="uptime_check_id",
                    key=AttributeKey(name="uptime_check_id", type=AttributeKey.Type.TYPE_STRING),
                ),
                Column(
                    label="scheduled_check_time",
                    key=AttributeKey(
                        name="scheduled_check_time", type=AttributeKey.Type.TYPE_DOUBLE
                    ),
                ),
                Column(
                    label="duration_ms",
                    key=AttributeKey(name="duration_ms", type=AttributeKey.Type.TYPE_INT),
                ),
                Column(
                    label="check_status_reason",
                    key=AttributeKey(
                        name="check_status_reason", type=AttributeKey.Type.TYPE_STRING
                    ),
                ),
            ]

    def _serialize_response(
        self,
        rpc_response: TraceItemTableResponse,
        uptime_subscription: ProjectUptimeSubscription,
        trace_item_type: TraceItemType.ValueType,
    ) -> list[EapCheckEntrySerializerResponse]:
        """
        Serialize the response from the EAP into a list of items per each uptime check.
        """
        column_values = rpc_response.column_values
        if not column_values:
            return []

        column_names = [cv.attribute_name for cv in column_values]
        entries: list[EapCheckEntry] = [
            self._transform_row(
                row_idx, column_values, column_names, uptime_subscription, trace_item_type
            )
            for row_idx in range(len(column_values[0].results))
        ]

        return serialize(entries)

    def _transform_row(
        self,
        row_idx: int,
        column_values: Any,
        column_names: list[str],
        uptime_subscription: ProjectUptimeSubscription,
        trace_item_type: TraceItemType.ValueType,
    ) -> EapCheckEntry:
        row_dict: dict[str, AttributeValue] = {
            col_name: column_values[col_idx].results[row_idx]
            for col_idx, col_name in enumerate(column_names)
        }
        if trace_item_type == TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT:
            uptime_check_id = row_dict["check_id"].val_str
            scheduled_check_time = datetime.fromtimestamp(
                row_dict.get("scheduled_check_time_us").val_int / 1_000_000
            )
            duration_val = row_dict.get("check_duration_us")
            duration_ms = (
                (duration_val.val_int // 1000) if duration_val and not duration_val.is_null else 0
            )
        else:
            uptime_check_id = row_dict["uptime_check_id"].val_str
            scheduled_check_time = datetime.fromtimestamp(
                row_dict["scheduled_check_time"].val_double
            )
            duration_ms = row_dict["duration_ms"].val_int

        return EapCheckEntry(
            uptime_check_id=uptime_check_id,
            uptime_subscription_id=uptime_subscription.id,
            timestamp=datetime.fromtimestamp(row_dict["timestamp"].val_double),
            scheduled_check_time=scheduled_check_time,
            check_status=cast(CheckStatus, row_dict["check_status"].val_str),
            check_status_reason=self._extract_check_status_reason(
                row_dict.get("check_status_reason")
            ),
            http_status_code=(
                None
                if row_dict["http_status_code"].is_null
                else row_dict["http_status_code"].val_int
            ),
            duration_ms=duration_ms,
            trace_id=row_dict["trace_id"].val_str,
            incident_status=IncidentStatus(row_dict["incident_status"].val_int),
            environment=row_dict.get("environment", AttributeValue(val_str="")).val_str,
            region=row_dict["region"].val_str,
        )

    def _extract_check_status_reason(
        self, check_status_reason_val: AttributeValue | None
    ) -> CheckStatusReasonType | None:
        """Extract check status reason from attribute value, handling null/empty cases."""
        if not check_status_reason_val or check_status_reason_val.is_null:
            return None
        val_str = check_status_reason_val.val_str
        return cast(CheckStatusReasonType, val_str) if val_str != "" else None

    def _get_date_cutoff_epoch_seconds(self) -> float | None:
        value = float(options.get("uptime.date_cutoff_epoch_seconds"))
        return None if value == 0 else value
