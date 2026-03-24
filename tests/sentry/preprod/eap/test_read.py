from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from unittest.mock import patch

import pytest
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableResponse
from sentry_protos.snuba.v1.request_common_pb2 import ResponseMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.preprod.eap.read import query_preprod_size_metrics
from sentry.testutils.cases import TestCase


class TestQueryPreprodSizeMetrics(TestCase):
    @patch("sentry.preprod.eap.read.snuba_rpc.table_rpc")
    def test_query_builds_request_correctly(self, mock_rpc):
        mock_rpc.return_value = [
            TraceItemTableResponse(
                meta=ResponseMeta(),
                column_values=[],
            )
        ]

        start = datetime(2024, 1, 1, 0, 0, 0, tzinfo=dt_timezone.utc)
        end = datetime(2024, 1, 31, 23, 59, 59, tzinfo=dt_timezone.utc)

        app_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="app_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="com.example.app"),
            )
        )

        query_preprod_size_metrics(
            organization_id=1,
            project_ids=[2, 3],
            start=start,
            end=end,
            referrer="test.preprod.query",
            filter=app_filter,
            limit=50,
            offset=10,
        )

        mock_rpc.assert_called_once()
        request = mock_rpc.call_args[0][0][0]

        assert request.meta.organization_id == 1
        assert request.meta.project_ids == [2, 3]
        assert request.meta.trace_item_type == TraceItemType.TRACE_ITEM_TYPE_PREPROD
        assert request.meta.referrer == "test.preprod.query"
        assert request.meta.cogs_category == "preprod_size_analysis"
        assert request.limit == 50
        assert request.page_token.offset == 10

        assert request.filter.comparison_filter.key.name == "app_id"
        assert request.filter.comparison_filter.value.val_str == "com.example.app"

    @patch("sentry.preprod.eap.read.snuba_rpc.table_rpc")
    def test_query_without_filters(self, mock_rpc):
        mock_rpc.return_value = [
            TraceItemTableResponse(
                meta=ResponseMeta(),
                column_values=[],
            )
        ]

        start = datetime.now(dt_timezone.utc) - timedelta(days=7)
        end = datetime.now(dt_timezone.utc)

        query_preprod_size_metrics(
            organization_id=1,
            project_ids=[2],
            start=start,
            end=end,
            referrer="test.preprod.query",
        )

        request = mock_rpc.call_args[0][0][0]
        assert not request.HasField("filter")

    @patch("sentry.preprod.eap.read.snuba_rpc.table_rpc")
    def test_query_raises_on_empty_response(self, mock_rpc):
        mock_rpc.return_value = []

        with pytest.raises(ValueError, match="No response from Snuba RPC"):
            query_preprod_size_metrics(
                organization_id=1,
                project_ids=[2],
                start=datetime.now(dt_timezone.utc) - timedelta(days=1),
                end=datetime.now(dt_timezone.utc),
                referrer="test.preprod.query",
            )
