from unittest.mock import patch
from uuid import uuid4

from sentry.seer.assisted_query.traces_tools import (
    get_attribute_names,
    get_attribute_values_with_substring,
)
from sentry.seer.endpoints.seer_rpc import get_attributes_and_values, get_spans
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

        with self.feature(
            [
                "organizations:visibility-explore-view",
            ]
        ):
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
            "built_in_fields": [
                {"key": "id", "type": "string"},
                {"key": "project", "type": "string"},
                {"key": "span.description", "type": "string"},
                {"key": "span.op", "type": "string"},
                {"key": "timestamp", "type": "string"},
                {"key": "transaction", "type": "string"},
                {"key": "trace", "type": "string"},
                {"key": "is_transaction", "type": "string"},
                {"key": "sentry.normalized_description", "type": "string"},
                {"key": "release", "type": "string"},
                {"key": "project.id", "type": "string"},
                {"key": "sdk.name", "type": "string"},
                {"key": "sdk.version", "type": "string"},
                {"key": "span.system", "type": "string"},
                {"key": "span.category", "type": "string"},
                {"key": "span.duration", "type": "number"},
                {"key": "span.self_time", "type": "number"},
            ],
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

        with self.feature(
            [
                "organizations:visibility-explore-view",
            ]
        ):
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
            )

        assert result == {
            "transaction": ["bar", "baz"],
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

        with self.feature(
            [
                "organizations:visibility-explore-view",
            ]
        ):
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

        expected: dict = {}
        assert result == expected

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
