from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from unittest.mock import patch

import pytest
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableResponse
from sentry_protos.snuba.v1.request_common_pb2 import ResponseMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.preprod.eap.read import PreprodSizeFilters, _build_filters, query_preprod_size_metrics
from sentry.testutils.cases import TestCase


class TestBuildFilters(TestCase):
    def test_artifact_id_converted_to_trace_id(self):
        filters = PreprodSizeFilters(artifact_id=123)
        result = _build_filters(filters)

        assert len(result) == 1
        filter_item = result[0].comparison_filter
        assert filter_item.key.name == "sentry.trace_id"
        assert filter_item.key.type == AttributeKey.Type.TYPE_STRING
        assert filter_item.value.val_str == "0000000000000000000000000000007b"

    def test_string_filters(self):
        filters = PreprodSizeFilters(
            app_id="com.example.app",
            git_head_ref="main",
            git_provider="github",
        )
        result = _build_filters(filters)

        assert len(result) == 3

        app_id_filter = next(f for f in result if f.comparison_filter.key.name == "app_id")
        assert app_id_filter.comparison_filter.key.type == AttributeKey.Type.TYPE_STRING
        assert app_id_filter.comparison_filter.value.val_str == "com.example.app"

        git_ref_filter = next(f for f in result if f.comparison_filter.key.name == "git_head_ref")
        assert git_ref_filter.comparison_filter.key.type == AttributeKey.Type.TYPE_STRING
        assert git_ref_filter.comparison_filter.value.val_str == "main"

    def test_int_filters(self):
        filters = PreprodSizeFilters(
            artifact_type=0,
            git_pr_number=42,
        )
        result = _build_filters(filters)

        assert len(result) == 2

        artifact_filter = next(f for f in result if f.comparison_filter.key.name == "artifact_type")
        assert artifact_filter.comparison_filter.key.type == AttributeKey.Type.TYPE_INT
        assert artifact_filter.comparison_filter.value.val_int == 0

        pr_filter = next(f for f in result if f.comparison_filter.key.name == "git_pr_number")
        assert pr_filter.comparison_filter.key.type == AttributeKey.Type.TYPE_INT
        assert pr_filter.comparison_filter.value.val_int == 42

    def test_none_values_skipped(self):
        filters = PreprodSizeFilters(
            app_id="com.example.app",
            git_head_ref=None,
            artifact_type=None,
        )
        result = _build_filters(filters)

        assert len(result) == 1
        assert result[0].comparison_filter.key.name == "app_id"

    def test_empty_filters(self):
        filters = PreprodSizeFilters()
        result = _build_filters(filters)

        assert len(result) == 0

    def test_artifact_id_with_large_value(self):
        filters = PreprodSizeFilters(artifact_id=999999999)
        result = _build_filters(filters)

        filter_item = result[0].comparison_filter
        assert filter_item.value.val_str == "0000000000000000000000003b9ac9ff"

    def test_combined_artifact_id_and_other_filters(self):
        filters = PreprodSizeFilters(
            artifact_id=123,
            app_id="com.example.app",
            git_head_ref="main",
        )
        result = _build_filters(filters)

        assert len(result) == 3

        trace_id_filter = next(
            f for f in result if f.comparison_filter.key.name == "sentry.trace_id"
        )
        assert trace_id_filter.comparison_filter.value.val_str == "0000000000000000000000000000007b"

        app_id_filter = next(f for f in result if f.comparison_filter.key.name == "app_id")
        assert app_id_filter.comparison_filter.value.val_str == "com.example.app"


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

        query_preprod_size_metrics(
            organization_id=1,
            project_ids=[2, 3],
            start=start,
            end=end,
            filters=PreprodSizeFilters(app_id="com.example.app"),
            limit=50,
            offset=10,
        )

        mock_rpc.assert_called_once()
        request = mock_rpc.call_args[0][0][0]

        assert request.meta.organization_id == 1
        assert request.meta.project_ids == [2, 3]
        assert request.meta.trace_item_type == TraceItemType.TRACE_ITEM_TYPE_PREPROD
        assert request.meta.referrer == "preprod.eap.debug"
        assert request.limit == 50
        assert request.page_token.offset == 10

        assert request.filter.and_filter.filters[0].comparison_filter.key.name == "app_id"

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
            )
