import logging
import uuid
from datetime import datetime
from typing import Any, cast

from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_kafka_schemas.schema_types.snuba_uptime_results_v1 import (
    Assertion,
    CheckStatus,
    CheckStatusReasonType,
)
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
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

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.api.utils import get_date_range_from_params, handle_query_errors
from sentry.models.project import Project
from sentry.uptime.eap_utils import get_columns_for_uptime_result
from sentry.uptime.endpoints.bases import ProjectUptimeAlertEndpoint
from sentry.uptime.endpoints.serializers import EapCheckEntrySerializerResponse
from sentry.uptime.models import UptimeSubscription, get_uptime_subscription
from sentry.uptime.types import EapCheckEntry, IncidentStatus
from sentry.utils import json, snuba_rpc
from sentry.workflow_engine.models import Detector

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
        uptime_detector: Detector,
    ) -> Response:
        uptime_subscription = get_uptime_subscription(uptime_detector)

        if uptime_subscription.subscription_id is None:
            return Response([])

        start, end = get_date_range_from_params(request.GET)

        def data_fn(offset: int, limit: int) -> Any:
            try:
                return self._make_eap_request(
                    project,
                    uptime_subscription,
                    offset,
                    limit,
                    start,
                    end,
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
        uptime_subscription: UptimeSubscription,
        offset: int,
        limit: int,
        start: datetime,
        end: datetime,
    ) -> list[EapCheckEntrySerializerResponse]:
        start_timestamp = Timestamp()
        start_timestamp.FromDatetime(start)
        end_timestamp = Timestamp()
        end_timestamp.FromDatetime(end)

        subscription_id = uuid.UUID(uptime_subscription.subscription_id).hex

        subscription_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(
                    name="subscription_id",
                    type=AttributeKey.Type.TYPE_STRING,
                ),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str=subscription_id),
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

        rpc_request = TraceItemTableRequest(
            meta=RequestMeta(
                referrer="uptime_alert_checks_index",
                organization_id=project.organization.id,
                project_ids=[project.id],
                trace_item_type=TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
                downsampled_storage_config=DownsampledStorageConfig(
                    mode=DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
                ),
            ),
            filter=query_filter,
            columns=get_columns_for_uptime_result(),
            order_by=[
                TraceItemTableRequest.OrderBy(
                    column=Column(
                        label="sentry.timestamp",
                        key=AttributeKey(
                            name="sentry.timestamp",
                            type=AttributeKey.Type.TYPE_DOUBLE,
                        ),
                    ),
                    descending=True,
                )
            ],
            limit=limit,
            page_token=PageToken(offset=offset),
        )
        return self._serialize_response(snuba_rpc.table_rpc([rpc_request])[0])

    def _serialize_response(
        self, rpc_response: TraceItemTableResponse
    ) -> list[EapCheckEntrySerializerResponse]:
        """
        Serialize the response from the EAP into a list of items per each uptime check.
        """
        column_values = rpc_response.column_values
        if not column_values:
            return []

        column_names = [cv.attribute_name for cv in column_values]
        entries: list[EapCheckEntry] = [
            self._transform_row(row_idx, column_values, column_names)
            for row_idx in range(len(column_values[0].results))
        ]

        return serialize(entries)

    def _transform_row(
        self,
        row_idx: int,
        column_values: Any,
        column_names: list[str],
    ) -> EapCheckEntry:
        row_dict: dict[str, AttributeValue] = {
            col_name: column_values[col_idx].results[row_idx]
            for col_idx, col_name in enumerate(column_names)
        }
        uptime_check_id = row_dict["check_id"].val_str
        scheduled_check_time = datetime.fromtimestamp(
            row_dict["scheduled_check_time_us"].val_int / 1_000_000
        )
        duration_val = row_dict.get("check_duration_us")
        duration_ms = (
            (duration_val.val_int // 1000) if duration_val and not duration_val.is_null else 0
        )
        trace_id = row_dict["sentry.trace_id"].val_str
        assertion_failure_data = self._extract_assertion_failure_data(
            row_dict.get("assertion_failure_data")
        )

        return EapCheckEntry(
            uptime_check_id=uptime_check_id,
            timestamp=datetime.fromtimestamp(row_dict["sentry.timestamp"].val_double),
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
            trace_id=trace_id,
            incident_status=IncidentStatus(row_dict["incident_status"].val_int),
            environment=row_dict.get("environment", AttributeValue(val_str="")).val_str,
            region=row_dict["region"].val_str,
            assertion_failure_data=assertion_failure_data,
        )

    def _extract_assertion_failure_data(self, val: AttributeValue | None) -> Assertion | None:
        """
        Extract assertion failure data from attribute value.

        This field is stored in EAP as a JSON-encoded string; return the decoded JSON value.
        If missing/null/empty or invalid JSON, return None.
        """
        if not val or val.is_null:
            return None

        raw = val.val_str
        if raw == "":
            return None

        try:
            return json.loads(raw)
        except (TypeError, ValueError):
            return None

    def _extract_check_status_reason(
        self, check_status_reason_val: AttributeValue | None
    ) -> CheckStatusReasonType | None:
        """Extract check status reason from attribute value, handling null/empty cases."""
        if not check_status_reason_val or check_status_reason_val.is_null:
            return None
        val_str = check_status_reason_val.val_str
        return cast(CheckStatusReasonType, val_str) if val_str != "" else None
