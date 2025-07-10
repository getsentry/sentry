from concurrent.futures import TimeoutError
from unittest.mock import Mock, patch
from uuid import uuid4

from sentry.api.endpoints.seer_rpc import (
    get_attribute_names,
    get_attribute_values_with_substring,
    get_attributes_and_values,
)
from sentry.testutils.cases import BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpointTestBase,
)


class OrganizationTraceItemAttributesEndpointSpansTest(
    OrganizationTraceItemAttributesEndpointTestBase, BaseSpansTestCase
):
    def test_get_attribute_names(self):
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

    def test_get_attribute_values_with_substring(self):
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

    def test_get_attributes_and_values(self):
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
        )

        assert result == {
            "attributes_and_values": [
                {
                    "test_tag": [
                        {"value": "foo", "count": 1.0},
                        {"value": "baz", "count": 1.0},
                        {"value": "bar", "count": 1.0},
                    ],
                },
                {
                    "another_tag": [
                        {"value": "another_value", "count": 1.0},
                    ],
                },
            ]
        }

    def test_get_attribute_values_with_substring_empty_field_list(self):
        """Test handling of empty fields_with_substrings list"""
        result = get_attribute_values_with_substring(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            stats_period="7d",
            fields_with_substrings=[],
        )

        expected: dict = {"values": {}}
        assert result == expected

    def test_get_attribute_values_with_substring_async_success_and_partial_failures(self):
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

        with patch("sentry.api.endpoints.seer_rpc.ThreadPoolExecutor") as mock_executor:
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

            with patch("sentry.api.endpoints.seer_rpc.as_completed") as mock_as_completed:

                def as_completed_side_effect(future_to_field_dict, timeout):
                    return [mock_future_success, mock_future_timeout, mock_future_exception]

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

    def test_get_attribute_values_with_substring_overall_timeout(self):
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

        with patch("sentry.api.endpoints.seer_rpc.as_completed") as mock_as_completed:
            mock_as_completed.side_effect = TimeoutError("Overall timeout")

            with patch("sentry.api.endpoints.seer_rpc.ThreadPoolExecutor") as mock_executor:
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

    def test_get_attribute_values_with_substring_max_workers_limit(self):
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

        with patch("sentry.api.endpoints.seer_rpc.ThreadPoolExecutor") as mock_executor:
            mock_executor_instance = Mock()
            mock_executor.return_value.__enter__.return_value = mock_executor_instance

            mock_futures = [Mock() for _ in range(15)]
            for i, future in enumerate(mock_futures):
                future.result.return_value = (f"transaction_{i}", {f"value_{i}"})

            mock_executor_instance.submit.side_effect = mock_futures

            with patch("sentry.api.endpoints.seer_rpc.as_completed") as mock_as_completed:
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
