from typing import int
from concurrent.futures import TimeoutError
from unittest.mock import Mock, patch
from uuid import uuid4

from sentry.seer.endpoints.seer_rpc import (
    get_attribute_names,
    get_attribute_values_with_substring,
    get_attributes_and_values,
    get_spans,
)
from sentry.testutils.cases import BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpointTestBase,
)


class OrganizationTraceItemAttributesEndpointSpansTest(
    OrganizationTraceItemAttributesEndpointTestBase, BaseSpansTestCase
):
    def test_get_attribute_names(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            transaction="foo",
            duration=100,
            exclusive_time=100,
            is_eap=True,
        )

        result = get_attribute_names(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            stats_period="7d",
        )
        assert result == {
            "fields": {
                "string": [
                    "span.description",
                    "project",
                    "transaction",
                ],
                "number": ["span.duration"],
            },
        }

    def test_get_attribute_values_with_substring(self) -> None:
        for transaction in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction=transaction,
                duration=100,
                exclusive_time=100,
                is_eap=True,
            )

        result = get_attribute_values_with_substring(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            stats_period="7d",
            fields_with_substrings=[
                {
                    "field": "transaction",
                    "substring": "ba",
                },
                {
                    "field": "transaction",
                    "substring": "b",
                },
            ],
            sampled=False,
        )

        assert result == {
            "values": {
                "transaction": {"bar", "baz"},
            }
        }

    def test_get_attributes_and_values(self) -> None:
        for tag_value in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                tags={"test_tag": tag_value},
                duration=100,
                exclusive_time=100,
                is_eap=True,
            )

        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            tags={"another_tag": "another_value"},
            duration=100,
            exclusive_time=100,
            is_eap=True,
        )

        result = get_attributes_and_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            stats_period="7d",
            sampled=False,
            attributes_ignored=[
                "sentry.segment_id",
                "sentry.event_id",
                "sentry.raw_description",
                "sentry.transaction",
            ],
        )

        assert result == {
            "attributes_and_values": {
                "test_tag": [
                    {"value": "foo", "count": 1.0},
                    {"value": "baz", "count": 1.0},
                    {"value": "bar", "count": 1.0},
                ],
                "another_tag": [
                    {"value": "another_value", "count": 1.0},
                ],
            },
        }

    def test_get_attribute_values_with_substring_empty_field_list(self) -> None:
        """Test handling of empty fields_with_substrings list"""
        result = get_attribute_values_with_substring(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            stats_period="7d",
            fields_with_substrings=[],
        )

        expected: dict = {"values": {}}
        assert result == expected

    def test_get_attribute_values_with_substring_async_success_and_partial_failures(
        self,
    ):
        """Test concurrent execution with successful results, timeouts, and exceptions"""
        for transaction in ["foo", "bar"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction=transaction,
                duration=100,
                exclusive_time=100,
                is_eap=True,
            )

        with patch("sentry.seer.endpoints.seer_rpc.ThreadPoolExecutor") as mock_executor:
            mock_executor_instance = Mock()
            mock_executor.return_value.__enter__.return_value = mock_executor_instance

            mock_future_success = Mock()
            mock_future_timeout = Mock()
            mock_future_exception = Mock()

            mock_future_success.result.return_value = ("transaction", {"foo", "bar"})
            mock_future_timeout.result.side_effect = TimeoutError("Individual timeout")
            mock_future_exception.result.side_effect = Exception("RPC failed")

            mock_executor_instance.submit.side_effect = [
                mock_future_success,
                mock_future_timeout,
                mock_future_exception,
            ]

            fields_with_substrings = [
                {"field": "transaction", "substring": "fo"},
                {"field": "span.description", "substring": "timeout_field"},
                {"field": "span.status", "substring": "error_field"},
            ]

            with patch("sentry.seer.endpoints.seer_rpc.as_completed") as mock_as_completed:

                def as_completed_side_effect(future_to_field_dict, timeout):
                    return [
                        mock_future_success,
                        mock_future_timeout,
                        mock_future_exception,
                    ]

                mock_as_completed.side_effect = as_completed_side_effect

                result = get_attribute_values_with_substring(
                    org_id=self.organization.id,
                    project_ids=[self.project.id],
                    stats_period="7d",
                    fields_with_substrings=fields_with_substrings,
                    sampled=False,
                )

                assert result == {
                    "values": {
                        "transaction": {"foo", "bar"},
                    }
                }

                assert mock_executor_instance.submit.call_count == 3
                mock_as_completed.assert_called_once()

    def test_get_attribute_values_with_substring_overall_timeout(self) -> None:
        """Test overall timeout handling with future cancellation"""
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            transaction="foo",
            duration=100,
            exclusive_time=100,
            is_eap=True,
        )

        with patch("sentry.seer.endpoints.seer_rpc.as_completed") as mock_as_completed:
            mock_as_completed.side_effect = TimeoutError("Overall timeout")

            with patch("sentry.seer.endpoints.seer_rpc.ThreadPoolExecutor") as mock_executor:
                mock_executor_instance = Mock()
                mock_executor.return_value.__enter__.return_value = mock_executor_instance

                mock_future1 = Mock()
                mock_future2 = Mock()
                mock_executor_instance.submit.side_effect = [mock_future1, mock_future2]

                result = get_attribute_values_with_substring(
                    org_id=self.organization.id,
                    project_ids=[self.project.id],
                    stats_period="7d",
                    fields_with_substrings=[
                        {"field": "transaction", "substring": "fo"},
                        {"field": "span.description", "substring": "desc"},
                    ],
                    sampled=False,
                )

                assert result == {"values": {}}

                mock_future1.cancel.assert_called_once()
                mock_future2.cancel.assert_called_once()

    def test_get_attribute_values_with_substring_max_workers_limit(self) -> None:
        """Test that ThreadPoolExecutor is limited to max 10 workers even with more fields"""
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            transaction="foo",
            duration=100,
            exclusive_time=100,
            is_eap=True,
        )

        fields_with_substrings = [
            {"field": "transaction", "substring": f"field_{i}"} for i in range(15)
        ]

        with patch("sentry.seer.endpoints.seer_rpc.ThreadPoolExecutor") as mock_executor:
            mock_executor_instance = Mock()
            mock_executor.return_value.__enter__.return_value = mock_executor_instance

            mock_futures = [Mock() for _ in range(15)]
            for i, future in enumerate(mock_futures):
                future.result.return_value = (f"transaction_{i}", {f"value_{i}"})

            mock_executor_instance.submit.side_effect = mock_futures

            with patch("sentry.seer.endpoints.seer_rpc.as_completed") as mock_as_completed:
                mock_as_completed.return_value = mock_futures

                get_attribute_values_with_substring(
                    org_id=self.organization.id,
                    project_ids=[self.project.id],
                    stats_period="7d",
                    fields_with_substrings=fields_with_substrings,
                    sampled=False,
                )

                mock_executor.assert_called_once_with(max_workers=10)
                assert mock_executor_instance.submit.call_count == 15

    def test_get_spans_basic(self) -> None:
        """Test basic get_spans functionality"""
        for i, transaction in enumerate(["foo", "bar", "baz"]):
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction=transaction,
                duration=i * 100,
                exclusive_time=100,
                is_eap=True,
            )

        result = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
                {"name": "span.duration", "type": "TYPE_DOUBLE"},
            ],
            limit=10,
        )

        assert "data" in result
        assert "meta" in result
        assert result["meta"]["columns"] == [
            {"name": "transaction", "type": "TYPE_STRING"},
            {"name": "span.duration", "type": "TYPE_DOUBLE"},
        ]
        assert result["meta"]["total_rows"] == 3

        transactions = {span["transaction"] for span in result["data"]}
        assert transactions == {"foo", "bar", "baz"}

        for span in result["data"]:
            assert "transaction" in span
            assert "span.duration" in span

        transaction_values = [span["transaction"] for span in result["data"]]
        assert transaction_values == sorted(transaction_values, reverse=True)

    def test_get_spans_with_query(self) -> None:
        """Test get_spans with query string filtering"""
        for i, transaction in enumerate(["foo", "bar", "baz"]):
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction=transaction,
                duration=i * 100,
                exclusive_time=100,
                is_eap=True,
            )

        # Simple "is" filter (single filter)
        result = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
                {"name": "span.duration", "type": "TYPE_DOUBLE"},
            ],
            query="transaction:foo",
            limit=10,
        )

        assert "data" in result
        assert "meta" in result
        assert result["meta"]["columns"] == [
            {"name": "transaction", "type": "TYPE_STRING"},
            {"name": "span.duration", "type": "TYPE_DOUBLE"},
        ]

        transactions = {span["transaction"] for span in result["data"]}
        assert transactions == {"foo"}

        for span in result["data"]:
            assert "transaction" in span
            assert "span.duration" in span

        # More complex query (multiple filters)
        result = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
                {"name": "span.duration", "type": "TYPE_DOUBLE"},
            ],
            query="transaction:foo or span.duration:>100",
            limit=10,
        )

        assert "data" in result
        assert "meta" in result
        assert result["meta"]["columns"] == [
            {"name": "transaction", "type": "TYPE_STRING"},
            {"name": "span.duration", "type": "TYPE_DOUBLE"},
        ]

        transactions = {span["transaction"] for span in result["data"]}
        assert transactions == {"foo", "baz"}

        for span in result["data"]:
            assert "transaction" in span
            assert "span.duration" in span

        # Test empty query string (should return all spans)
        result_empty = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
                {"name": "span.duration", "type": "TYPE_DOUBLE"},
            ],
            query="",
            limit=10,
        )
        assert len(result_empty["data"]) == 3
        transactions_empty = {span["transaction"] for span in result_empty["data"]}
        assert transactions_empty == {"foo", "bar", "baz"}

        # Test whitespace-only query (should return all spans)
        result_whitespace = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
                {"name": "span.duration", "type": "TYPE_DOUBLE"},
            ],
            query="   \t  ",
            limit=10,
        )
        assert len(result_whitespace["data"]) == 3
        transactions_whitespace = {span["transaction"] for span in result_whitespace["data"]}
        assert transactions_whitespace == {"foo", "bar", "baz"}

    def test_get_spans_with_sort(self) -> None:
        """Test get_spans with sort string"""
        for i, transaction in enumerate(["foo", "bar", "zog", "baz"]):
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction=transaction,
                duration=i * 100,
                exclusive_time=100,
                is_eap=True,
            )
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            transaction="zag",
            duration=200,
            exclusive_time=100,
            is_eap=True,
        )

        result = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
                {"name": "span.duration", "type": "TYPE_DOUBLE"},
            ],
            sort=[
                {
                    "name": "span.duration",
                    "type": "TYPE_DOUBLE",
                    "descending": True,
                },
                {
                    "name": "transaction",
                    "type": "TYPE_STRING",
                    "descending": True,
                },
            ],
        )

        assert result["data"] == [
            {"transaction": "baz", "span.duration": 300.0},  # Highest duration first
            {
                "transaction": "zog",
                "span.duration": 200.0,
            },  # For duration=200, 'zog' > 'zag' in DESC order
            {
                "transaction": "zag",
                "span.duration": 200.0,
            },  # Same duration, secondary sort by transaction DESC
            {"transaction": "bar", "span.duration": 100.0},  # Third highest duration
            {"transaction": "foo", "span.duration": 0.0},  # Lowest duration last
        ]

        result_desc = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
                {"name": "span.duration", "type": "TYPE_DOUBLE"},
            ],
            sort=[
                {
                    "name": "span.duration",
                    "type": "TYPE_DOUBLE",
                    "descending": True,
                },
            ],
        )
        assert result_desc["data"] == [
            {"transaction": "baz", "span.duration": 300.0},
            {
                "transaction": "zag",
                "span.duration": 200.0,
            },
            {
                "transaction": "zog",
                "span.duration": 200.0,
            },
            {"transaction": "bar", "span.duration": 100.0},
            {"transaction": "foo", "span.duration": 0.0},
        ]

        result_string_asc = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
                {"name": "span.duration", "type": "TYPE_DOUBLE"},
            ],
            sort=[
                {
                    "name": "transaction",
                    "type": "TYPE_STRING",
                    "descending": False,
                },
            ],
        )
        transaction_order = [span["transaction"] for span in result_string_asc["data"]]
        assert transaction_order == ["bar", "baz", "foo", "zag", "zog"]  # Alphabetical ascending

        result_string_desc = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
                {"name": "span.duration", "type": "TYPE_DOUBLE"},
            ],
            sort=[
                {
                    "name": "transaction",
                    "type": "TYPE_STRING",
                    "descending": True,
                },
            ],
        )
        transaction_order_desc = [span["transaction"] for span in result_string_desc["data"]]
        assert transaction_order_desc == [
            "zog",
            "zag",
            "foo",
            "baz",
            "bar",
        ]

    def test_get_spans_invalid_stats_period(self) -> None:
        """Test get_spans with invalid stats_period defaults to 7d"""
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            transaction="foo",
            duration=100,
            exclusive_time=100,
            is_eap=True,
        )

        result = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
            ],
            stats_period="invalid_period",
        )

        assert "data" in result
        assert "meta" in result
        assert len(result["data"]) >= 0

    @patch("sentry.seer.endpoints.seer_rpc.table_rpc")
    def test_get_spans_empty_response(self, mock_table_rpc) -> None:
        """Test get_spans handles empty response from table_rpc"""
        mock_table_rpc.return_value = []

        result = get_spans(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            columns=[
                {"name": "transaction", "type": "TYPE_STRING"},
            ],
        )

        assert result == {"data": [], "meta": {}}
        mock_table_rpc.assert_called_once()
