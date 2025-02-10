from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.api.utils import get_date_range_from_params, handle_query_errors
from sentry.models.project import Project
from sentry.uptime.endpoints.bases import ProjectUptimeAlertEndpoint
from sentry.uptime.models import ProjectUptimeSubscription
from sentry.utils import snuba_rpc


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
        start, end = get_date_range_from_params(request.GET)

        def data_fn(offset: int, limit: int) -> Any:
            rpc_response = self._make_eap_request(
                project, uptime_subscription, offset=offset, limit=limit, start=start, end=end
            )
            return self._format_response(rpc_response, uptime_subscription)

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
    ) -> TraceItemTableResponse:
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
        rpc_request = TraceItemTableRequest(
            meta=RequestMeta(
                referrer="uptime_alert_checks_index",
                organization_id=project.organization.id,
                project_ids=[project.id],
                trace_item_type=TraceItemType.TRACE_ITEM_TYPE_UPTIME_CHECK,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
            ),
            filter=TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(
                        name="uptime_subscription_id",
                        type=AttributeKey.Type.TYPE_STRING,
                    ),
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(
                        val_str=str(uptime_subscription.uptime_subscription.subscription_id)
                    ),
                )
            ),
            columns=[
                Column(
                    label="environment",
                    key=AttributeKey(name="environment", type=AttributeKey.Type.TYPE_STRING),
                ),
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
                    label="timestamp",
                    key=AttributeKey(name="timestamp", type=AttributeKey.Type.TYPE_DOUBLE),
                ),
                Column(
                    label="duration_ms",
                    key=AttributeKey(name="duration_ms", type=AttributeKey.Type.TYPE_INT),
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
                    label="check_status_reason",
                    key=AttributeKey(
                        name="check_status_reason", type=AttributeKey.Type.TYPE_STRING
                    ),
                ),
                Column(
                    label="trace_id",
                    key=AttributeKey(name="trace_id", type=AttributeKey.Type.TYPE_STRING),
                ),
                Column(
                    label="http_status_code",
                    key=AttributeKey(name="http_status_code", type=AttributeKey.Type.TYPE_INT),
                ),
            ],
            order_by=[
                TraceItemTableRequest.OrderBy(
                    column=Column(
                        label="timestamp",
                        key=AttributeKey(name="timestamp", type=AttributeKey.Type.TYPE_INT),
                    ),
                    descending=True,
                )
            ],
            limit=limit,
            page_token=PageToken(offset=offset),
        )

        rpc_response = snuba_rpc.table_rpc([rpc_request])[0]
        return rpc_response

    def _format_response(
        self, rpc_response: TraceItemTableResponse, uptime_subscription: ProjectUptimeSubscription
    ) -> list[dict[str, int | str | float]]:
        """
        Transform the response from the EAP into a list of items per each uptime check.
        """
        column_values = rpc_response.column_values
        if not column_values:
            return []

        column_names = [cv.attribute_name for cv in column_values]
        return [
            self._format_row(row_idx, column_values, column_names, uptime_subscription)
            for row_idx in range(len(column_values[0].results))
        ]

    def _format_row(
        self,
        row_idx: int,
        column_values: Any,
        column_names: list[str],
        uptime_subscription: ProjectUptimeSubscription,
    ) -> dict[str, int | str | float]:
        row_dict: dict[str, int | str | float] = {}
        for col_idx, col_name in enumerate(column_names):
            result = column_values[col_idx].results[row_idx]
            row_dict.update(self._extract_field_value(result, col_name, uptime_subscription))
        return convert_dict_key_case(row_dict, snake_to_camel_case)

    def _extract_field_value(
        self, result, col_name: str, uptime_subscription: ProjectUptimeSubscription
    ) -> Mapping[str, int | str | float]:
        if result.HasField("val_str"):
            return self._handle_string_field(result.val_str, col_name, uptime_subscription)
        elif result.HasField("val_int"):
            return {col_name: int(result.val_int)}
        elif result.HasField("val_double"):
            return self._handle_double_field(result.val_double, col_name)
        return {}

    def _handle_string_field(
        self, value: str, col_name: str, uptime_subscription: ProjectUptimeSubscription
    ) -> Mapping[str, int | str | float]:
        if col_name == "uptime_subscription_id":
            # map this back to the project uptime subscription id
            return {
                "project_uptime_subscription_id": uptime_subscription.id,
                col_name: uptime_subscription.id,
            }
        return {col_name: value}

    def _handle_double_field(self, value: float, col_name: str) -> Mapping[str, int | str | float]:
        if col_name in ("scheduled_check_time", "timestamp"):
            return {col_name: datetime.fromtimestamp(value).strftime("%Y-%m-%dT%H:%M:%SZ")}
        return {col_name: value}

    def _get_date_cutoff_epoch_seconds(self) -> float | None:
        value = float(options.get("uptime.date_cutoff_epoch_seconds"))
        return None if value == 0 else value
