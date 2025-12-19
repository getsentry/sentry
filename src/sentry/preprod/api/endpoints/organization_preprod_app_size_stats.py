from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableResponse
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.organization import Organization
from sentry.preprod.eap.constants import PREPROD_NAMESPACE
from sentry.preprod.eap.read import query_preprod_size_metrics
from sentry.utils.dates import parse_stats_period

logger = logging.getLogger(__name__)


def extract_unique_values_from_response(
    response: TraceItemTableResponse,
) -> dict[str, set[str]]:
    """Extract unique string values from each column in the response."""
    unique_values: dict[str, set[str]] = {}

    if not response.column_values:
        return unique_values

    # Iterate through each column
    for column in response.column_values:
        attr_name = column.attribute_name
        unique_values[attr_name] = set()

        # Iterate through all results in this column
        for result in column.results:
            if result.HasField("val_str") and result.val_str:
                unique_values[attr_name].add(result.val_str)

    return unique_values


@region_silo_endpoint
class OrganizationPreprodAppSizeStatsEndpoint(OrganizationEndpoint):
    """
    Returns time-series data for app size metrics stored in EAP.
    Compatible with Sentry dashboard widgets.
    """

    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieve app size metrics over time.

        Query Parameters:
        - project: Project ID(s) (can be repeated or comma-separated)
        - start: Start timestamp (ISO format or Unix timestamp)
        - end: End timestamp (ISO format or Unix timestamp)
        - statsPeriod: Alternative to start/end (e.g., "14d", "24h")
        - interval: Time interval for buckets (e.g., "1h", "1d")
        - field: Aggregate field (e.g., "max(max_install_size)")
        - query: Filter query string (e.g., "app_id:com.example.app artifact_type:0")
        - includeFilters: If "true", includes available filter values in response

        Response Format:
        {
            "data": [[timestamp, [{"count": value}]], ...],
            "start": unix_timestamp,
            "end": unix_timestamp,
            "meta": {...},
            "filters": {  // Only if includeFilters=true
                "app_ids": ["com.example.app", ...],
                "branches": ["main", "develop", ...]
            }
        }
        """
        try:
            project_ids_set = self.get_requested_project_ids_unchecked(request)
            if not project_ids_set:
                projects = self.get_projects(request, organization)
                project_ids = [p.id for p in projects]
            else:
                project_ids = list(project_ids_set)

            start, end = self._parse_time_range(request)

            interval = request.GET.get("interval", "1d")
            interval_seconds = self._parse_interval(interval)

            field = request.GET.get("field", "max(max_install_size)")
            aggregate_func, aggregate_field = self._parse_field(field)

            filter_kwargs = self._parse_query(request.GET.get("query", ""))
            query_filter = self._build_filter(filter_kwargs) if filter_kwargs else None

            response = query_preprod_size_metrics(
                organization_id=organization.id,
                project_ids=project_ids,
                start=start,
                end=end,
                referrer="api.preprod.app-size-stats",
                filter=query_filter,
                limit=10000,  # Get all data points
            )

            # Transform to time-series format
            timeseries_data = self._transform_to_timeseries(
                response, start, end, interval_seconds, aggregate_func, aggregate_field
            )

            result: dict[str, Any] = {
                "data": timeseries_data,
                "start": int(start.timestamp()),
                "end": int(end.timestamp()),
                "meta": {
                    "fields": {
                        field: "integer",
                    }
                },
            }

            # Include available filter values if requested
            include_filters = request.GET.get("includeFilters", "").lower() == "true"
            if include_filters:
                filter_values = self._fetch_filter_values(organization.id, project_ids, start, end)
                result["filters"] = filter_values

            return Response(result)

        except (ValueError, KeyError) as e:
            logger.exception("[AppSize] Parse error: %s", e)
            raise ParseError(str(e))
        except Exception as e:
            logger.exception("[AppSize] Unexpected error: %s", e)
            raise ResourceDoesNotExist(f"Failed to fetch app size metrics: {e}")

    def _parse_time_range(self, request: Request) -> tuple[datetime, datetime]:
        """Parse start/end or statsPeriod from request."""
        stats_period = request.GET.get("statsPeriod")
        start_param = request.GET.get("start")
        end_param = request.GET.get("end")

        if stats_period:
            # Parse relative period like "14d" or "24h"
            delta = parse_stats_period(stats_period)
            if delta is None:
                raise ParseError(f"Invalid statsPeriod: {stats_period}")
            end = datetime.now(UTC)
            start = end - delta
        elif start_param and end_param:
            # Parse absolute timestamps
            start = self._parse_datetime(start_param)
            end = self._parse_datetime(end_param)
        else:
            # Default to last 14 days
            end = datetime.now(UTC)
            start = end - timedelta(days=14)

        return start, end

    def _parse_datetime(self, value: str) -> datetime:
        """Parse datetime from ISO format or Unix timestamp."""
        try:
            # Try Unix timestamp first
            return datetime.fromtimestamp(float(value), UTC)
        except (ValueError, TypeError):
            # Try ISO format
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                raise ParseError(f"Invalid datetime format: {value}")

    def _parse_interval(self, interval: str) -> int:
        """Parse interval string like '1h', '1d' to seconds."""
        interval_map = {
            "1m": 60,
            "5m": 300,
            "10m": 600,
            "15m": 900,
            "30m": 1800,
            "1h": 3600,
            "4h": 14400,
            "1d": 86400,
            "7d": 604800,
        }
        if interval not in interval_map:
            raise ParseError(f"Invalid interval: {interval}")
        return interval_map[interval]

    def _parse_field(self, field: str) -> tuple[str, str]:
        """
        Parse field like 'max(max_install_size)' into ('max', 'max_install_size').
        """
        if "(" not in field or ")" not in field:
            raise ParseError(f"Invalid field format: {field}")

        func_name = field[: field.index("(")]
        field_name = field[field.index("(") + 1 : field.index(")")]

        valid_funcs = ["max", "min", "avg", "count"]
        if func_name not in valid_funcs:
            raise ParseError(f"Unsupported aggregate function: {func_name}")

        valid_fields = [
            "max_install_size",
            "max_download_size",
            "min_install_size",
            "min_download_size",
        ]
        if field_name and field_name not in valid_fields:
            raise ParseError(f"Invalid field: {field_name}")

        return func_name, field_name

    def _parse_query(self, query: str) -> dict[str, Any]:
        """
        Parse query string like 'app_id:com.example.app artifact_type:0' into filter kwargs.
        """
        filters: dict[str, str | int] = {}

        if not query:
            return filters

        # Simple space-separated key:value parsing
        for token in query.split():
            if ":" not in token:
                continue

            key, value = token.split(":", 1)

            # Map query keys to function kwargs
            if key == "app_id":
                filters["app_id"] = value
            elif key == "artifact_type":
                filters["artifact_type"] = int(value)
            elif key == "build_configuration_name":
                filters["build_configuration_name"] = value
            elif key == "git_head_ref":
                filters["git_head_ref"] = value
            elif key == "artifact_id":
                filters["artifact_id"] = int(value)

        return filters

    def _build_filter(self, filter_kwargs: dict[str, Any]) -> TraceItemFilter:
        """Build TraceItemFilter from parsed query parameters."""
        filters = []

        for key, value in filter_kwargs.items():
            if key == "artifact_id":
                # Special case: artifact_id maps to sentry.trace_id
                trace_id = uuid.uuid5(PREPROD_NAMESPACE, str(value)).hex
                filters.append(
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="sentry.trace_id", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str=trace_id),
                        )
                    )
                )
            elif isinstance(value, str):
                filters.append(
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name=key, type=AttributeKey.Type.TYPE_STRING),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str=value),
                        )
                    )
                )
            elif isinstance(value, int):
                filters.append(
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name=key, type=AttributeKey.Type.TYPE_INT),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_int=value),
                        )
                    )
                )

        if len(filters) == 1:
            return filters[0]
        return TraceItemFilter(and_filter=AndFilter(filters=filters))

    def _transform_to_timeseries(
        self,
        response: TraceItemTableResponse,
        start: datetime,
        end: datetime,
        interval_seconds: int,
        aggregate_func: str,
        aggregate_field: str,
    ) -> list[tuple[int, list[dict[str, Any]]]]:
        """
        Transform EAP protobuf response into dashboard time-series format.

        Output format: [[timestamp, [{"count": value}]], ...]

        Note: EAP response is column-oriented (column_values[col_idx].results[row_idx])
        """
        # Create time buckets
        buckets: dict[int, list[float]] = defaultdict(list)

        # Extract column names and find indices
        column_map: dict[str, int] = {}
        column_values = response.column_values

        if not column_values:
            # No data, return empty buckets with None
            result: list[tuple[int, list[dict[str, Any]]]] = []
            start_ts = int(start.timestamp())
            current = int(start_ts // interval_seconds * interval_seconds)
            end_ts = int(end.timestamp())
            while current < end_ts:
                result.append((current, [{"count": None}]))
                current += interval_seconds
            return result

        for idx, column_value in enumerate(column_values):
            column_map[column_value.attribute_name] = idx

        # Get the target field index
        if aggregate_field not in column_map:
            # If field doesn't exist, return None values
            result = []
            start_ts = int(start.timestamp())
            current = int(start_ts // interval_seconds * interval_seconds)
            end_ts = int(end.timestamp())
            while current < end_ts:
                result.append((current, [{"count": None}]))
                current += interval_seconds
            return result

        field_idx = column_map[aggregate_field]
        timestamp_idx = column_map.get("timestamp")

        if timestamp_idx is None:
            # No timestamp column, return None values
            result = []
            start_ts = int(start.timestamp())
            current = int(start_ts // interval_seconds * interval_seconds)
            end_ts = int(end.timestamp())
            while current < end_ts:
                result.append((current, [{"count": None}]))
                current += interval_seconds
            return result

        # Process each row (iterate through results in column-oriented format)
        num_rows = len(column_values[0].results)

        for row_idx in range(num_rows):
            # Get timestamp for this row
            timestamp_result = column_values[timestamp_idx].results[row_idx]

            if timestamp_result.HasField("val_double"):
                timestamp = timestamp_result.val_double
            elif timestamp_result.HasField("val_float"):
                timestamp = timestamp_result.val_float
            else:
                continue

            bucket_ts = int(timestamp // interval_seconds * interval_seconds)

            # Get the value for this row
            value_result = column_values[field_idx].results[row_idx]
            value = None

            if value_result.HasField("val_int"):
                value = float(value_result.val_int)
            elif value_result.HasField("val_double"):
                value = value_result.val_double
            elif value_result.HasField("val_float"):
                value = value_result.val_float

            if value is not None:
                buckets[bucket_ts].append(value)

        result = []
        # Align start time to interval boundary
        start_ts = int(start.timestamp())
        current = int(start_ts // interval_seconds * interval_seconds)
        end_ts = int(end.timestamp())

        while current < end_ts:
            values = buckets.get(current, [])

            if not values:
                # Use None for missing data so chart interpolates instead of showing 0
                aggregated = None
            elif aggregate_func == "max":
                aggregated = max(values)
            elif aggregate_func == "min":
                aggregated = min(values)
            elif aggregate_func == "avg":
                aggregated = sum(values) / len(values)
            elif aggregate_func == "count":
                aggregated = len(values)
            else:
                aggregated = None

            result.append(
                (current, [{"count": int(aggregated) if aggregated is not None else None}])
            )
            current += interval_seconds

        return result

    def _fetch_filter_values(
        self,
        organization_id: int,
        project_ids: list[int],
        start: datetime,
        end: datetime,
    ) -> dict[str, list[str]]:
        """
        Fetch available filter values (app_ids, branches, and build configs) from EAP data.

        Returns a dict with sorted lists of unique values.
        """
        # Query for app_id, git_head_ref, and build_configuration_name columns over the time range
        response = query_preprod_size_metrics(
            organization_id=organization_id,
            project_ids=project_ids,
            start=start,
            end=end,
            referrer="api.preprod.app-size-filters",
            filter=None,
            columns=["app_id", "git_head_ref", "build_configuration_name"],
            limit=10000,  # Get many rows to extract unique values
        )

        # Extract unique values using the helper function
        unique_values = extract_unique_values_from_response(response)

        return {
            "app_ids": sorted(list(unique_values.get("app_id", set()))),
            "branches": sorted(list(unique_values.get("git_head_ref", set()))),
            "build_configs": sorted(list(unique_values.get("build_configuration_name", set()))),
        }
