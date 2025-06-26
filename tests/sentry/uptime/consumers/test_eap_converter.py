from unittest import TestCase

import pytest
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.testutils.cases import TestCase as SentryTestCase
from sentry.uptime.consumers.eap_converter import (
    _anyvalue,
    convert_uptime_request_to_trace_item,
    convert_uptime_result_to_trace_items,
    ms_to_us,
)


class TestHelperFunctions(TestCase):
    def test_anyvalue_string(self):
        result = _anyvalue("test")
        assert result.string_value == "test"

    def test_anyvalue_int(self):
        result = _anyvalue(123)
        assert result.int_value == 123

    def test_anyvalue_float(self):
        result = _anyvalue(123.45)
        assert result.double_value == 123.45

    def test_anyvalue_bool(self):
        result = _anyvalue(True)
        assert result.bool_value is True

    def test_anyvalue_fallback(self):
        with pytest.raises(ValueError):
            _anyvalue([1, 2, 3])  # type: ignore[arg-type] # Test with unsupported type

    def test_microseconds_conversion(self):
        assert ms_to_us(1000) == 1000000
        assert ms_to_us(1.5) == 1500

    def test_timestamp_conversion(self):
        timestamp = Timestamp()
        timestamp.FromMilliseconds(1609459200000)
        assert timestamp.ToMilliseconds() == 1609459200000


class TestDenormalizedUptimeConverter(SentryTestCase):
    def _create_base_result(self, **overrides):
        return {
            "guid": "test-guid-123",
            "subscription_id": "sub-456",
            "status": "success",
            "status_reason": None,
            "trace_id": "trace-789",
            "span_id": "span-789",
            "scheduled_check_time_ms": 1609459200000,
            "actual_check_time_ms": 1609459205000,
            "duration_ms": 150,
            "request_info": None,
            "region": "us-east-1",
            **overrides,
        }

    def _create_base_request_info(self, **overrides):
        return {
            "url": "https://example.com",
            "request_type": "GET",
            "http_status_code": 200,
            "request_body_size_bytes": 0,
            "response_body_size_bytes": 1024,
            "request_duration_us": 125000,
            **overrides,
        }

    def _assert_trace_item_base_fields(
        self,
        trace_item,
        expected_trace_id="trace-789",
        expected_scheduled_time_ms=1609459200000,
        expected_actual_time_ms=1609459205000,
    ):
        assert trace_item.organization_id == self.project.organization_id
        assert trace_item.project_id == self.project.id
        assert trace_item.trace_id == expected_trace_id
        assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT
        assert trace_item.client_sample_rate == 1.0
        assert trace_item.server_sample_rate == 1.0
        assert trace_item.retention_days > 0
        # Timestamp fields should preserve millisecond precision
        assert trace_item.timestamp.ToMilliseconds() == int(expected_scheduled_time_ms)
        assert trace_item.received.ToMilliseconds() == int(expected_actual_time_ms)

    def test_convert_single_request_with_denormalized_data(self):
        result = self._create_base_result()
        request_info = self._create_base_request_info()

        item_id = b"span-789"[:16].ljust(16, b"\x00")
        trace_item = convert_uptime_request_to_trace_item(
            self.project, result, request_info, 0, item_id
        )

        self._assert_trace_item_base_fields(trace_item)
        assert trace_item.item_id == item_id

        attributes = trace_item.attributes

        assert attributes["guid"].string_value == "test-guid-123"
        assert attributes["subscription_id"].string_value == "sub-456"
        assert attributes["check_status"].string_value == "success"
        assert attributes["region"].string_value == "us-east-1"
        assert attributes["check_duration_us"].int_value == 150000
        assert attributes["scheduled_check_time_us"].int_value == 1609459200000000
        assert attributes["actual_check_time_us"].int_value == 1609459205000000

        assert attributes["check_id"].string_value == "test-guid-123"
        assert attributes["request_sequence"].int_value == 0
        assert attributes["request_url"].string_value == "https://example.com"
        assert attributes["request_type"].string_value == "GET"
        assert attributes["http_status_code"].int_value == 200
        assert attributes["request_duration_us"].int_value == 125000
        assert attributes["request_body_size_bytes"].int_value == 0
        assert attributes["response_body_size_bytes"].int_value == 1024

    def test_convert_with_status_reason_denormalized(self):
        """Test that status reason is included in denormalized data."""
        result = self._create_base_result(
            status="failure",
            status_reason={"type": "timeout", "description": "Request timed out after 30 seconds"},
            duration_ms=30000,
        )
        request_info = self._create_base_request_info(http_status_code=500)

        item_id = b"span-789"[:16].ljust(16, b"\x00")
        trace_item = convert_uptime_request_to_trace_item(
            self.project, result, request_info, 0, item_id
        )

        self._assert_trace_item_base_fields(trace_item)
        attributes = trace_item.attributes
        assert attributes["check_status"].string_value == "failure"
        assert attributes["status_reason_type"].string_value == "timeout"
        assert (
            attributes["status_reason_description"].string_value
            == "Request timed out after 30 seconds"
        )

    def test_convert_with_timing_breakdown(self):
        """Test detailed timing breakdown in request data."""
        result = self._create_base_result()
        request_info = self._create_base_request_info(
            request_duration_us=200000,
            durations={
                "dns_lookup": {"start_us": 1000, "duration_us": 50000},
                "tcp_connection": {"start_us": 51000, "duration_us": 25000},
                "tls_handshake": {"start_us": 76000, "duration_us": 30000},
                "time_to_first_byte": {"start_us": 106000, "duration_us": 80000},
            },
        )

        item_id = b"span-789"[:16].ljust(16, b"\x00")
        trace_item = convert_uptime_request_to_trace_item(
            self.project, result, request_info, 0, item_id
        )

        self._assert_trace_item_base_fields(trace_item)
        attributes = trace_item.attributes
        assert attributes["request_duration_us"].int_value == 200000
        assert attributes["dns_lookup_start_us"].int_value == 1000
        assert attributes["dns_lookup_duration_us"].int_value == 50000
        assert attributes["tcp_connection_start_us"].int_value == 51000
        assert attributes["tcp_connection_duration_us"].int_value == 25000
        assert attributes["tls_handshake_start_us"].int_value == 76000
        assert attributes["tls_handshake_duration_us"].int_value == 30000
        assert attributes["time_to_first_byte_start_us"].int_value == 106000
        assert attributes["time_to_first_byte_duration_us"].int_value == 80000

    def test_timestamp_conversion_accuracy(self):
        """Test that timestamps are accurately converted from milliseconds to seconds."""
        custom_scheduled_time = 1609459999000  # Different timestamp
        custom_actual_time = 1609460001000  # Different timestamp

        result = self._create_base_result(
            scheduled_check_time_ms=custom_scheduled_time, actual_check_time_ms=custom_actual_time
        )
        request_info = self._create_base_request_info()

        item_id = b"span-789"[:16].ljust(16, b"\x00")
        trace_item = convert_uptime_request_to_trace_item(
            self.project, result, request_info, 0, item_id
        )

        # Validate exact timestamp conversion
        self._assert_trace_item_base_fields(
            trace_item,
            expected_scheduled_time_ms=custom_scheduled_time,
            expected_actual_time_ms=custom_actual_time,
        )

        # Double-check the exact values
        assert trace_item.timestamp.ToMilliseconds() == 1609459999000
        assert trace_item.received.ToMilliseconds() == 1609460001000

    def test_complete_timing_breakdown_all_phases(self):
        """Test all timing phases including send_request and receive_response."""
        result = self._create_base_result()
        request_info = self._create_base_request_info(
            durations={
                "dns_lookup": {"start_us": 1000, "duration_us": 10000},
                "tcp_connection": {"start_us": 11000, "duration_us": 15000},
                "tls_handshake": {"start_us": 26000, "duration_us": 20000},
                "time_to_first_byte": {"start_us": 46000, "duration_us": 30000},
                "send_request": {"start_us": 76000, "duration_us": 5000},
                "receive_response": {"start_us": 81000, "duration_us": 25000},
            },
        )

        item_id = b"span-789"[:16].ljust(16, b"\x00")
        trace_item = convert_uptime_request_to_trace_item(
            self.project, result, request_info, 0, item_id
        )

        attributes = trace_item.attributes
        # Test all timing phases
        assert attributes["dns_lookup_start_us"].int_value == 1000
        assert attributes["dns_lookup_duration_us"].int_value == 10000
        assert attributes["tcp_connection_start_us"].int_value == 11000
        assert attributes["tcp_connection_duration_us"].int_value == 15000
        assert attributes["tls_handshake_start_us"].int_value == 26000
        assert attributes["tls_handshake_duration_us"].int_value == 20000
        assert attributes["time_to_first_byte_start_us"].int_value == 46000
        assert attributes["time_to_first_byte_duration_us"].int_value == 30000
        assert attributes["send_request_start_us"].int_value == 76000
        assert attributes["send_request_duration_us"].int_value == 5000
        assert attributes["receive_response_start_us"].int_value == 81000
        assert attributes["receive_response_duration_us"].int_value == 25000

    def test_method_and_original_url_from_request_info_list(self):
        """Test that method and original_url are set from request_info_list."""
        result = self._create_base_result(
            request_info_list=[
                {
                    "url": "https://original.example.com/path",
                    "request_type": "POST",
                    "http_status_code": 302,
                },
                {
                    "url": "https://redirected.example.com",
                    "request_type": "GET",
                    "http_status_code": 200,
                },
            ]
        )

        item_id = b"span-789"[:16].ljust(16, b"\x00")
        trace_item = convert_uptime_request_to_trace_item(
            self.project, result, result["request_info_list"][0], 0, item_id
        )

        attributes = trace_item.attributes
        assert attributes["method"].string_value == "POST"
        assert attributes["original_url"].string_value == "https://original.example.com/path"


class TestFullDenormalizedConversion(SentryTestCase):

    def _create_base_result(self, **overrides):
        """Create a base CheckResult for testing."""
        base = {
            "guid": "test-guid-123",
            "subscription_id": "sub-456",
            "status": "success",
            "status_reason": None,
            "trace_id": "trace-789",
            "span_id": "span-789",
            "scheduled_check_time_ms": 1609459200000,
            "actual_check_time_ms": 1609459205000,
            "duration_ms": 150,
            "request_info": None,
            "region": "us-east-1",
        }
        base.update(overrides)
        return base

    def test_convert_redirect_chain_denormalized(self):
        result = self._create_base_result(
            duration_ms=250,
            request_info_list=[
                {
                    "url": "https://example.com",
                    "request_type": "GET",
                    "http_status_code": 301,
                    "request_duration_us": 100000,
                },
                {
                    "url": "https://www.example.com",
                    "request_type": "GET",
                    "http_status_code": 200,
                    "request_duration_us": 150000,
                },
            ],
        )

        trace_items = convert_uptime_result_to_trace_items(self.project, result)

        assert len(trace_items) == 2

        for trace_item in trace_items:
            assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT
            assert trace_item.client_sample_rate == 1.0
            assert trace_item.server_sample_rate == 1.0
            attributes = trace_item.attributes

            assert attributes["guid"].string_value == "test-guid-123"
            assert attributes["check_status"].string_value == "success"
            assert attributes["region"].string_value == "us-east-1"
            assert attributes["check_duration_us"].int_value == 250000

        first_item = trace_items[0]
        assert first_item.attributes["request_sequence"].int_value == 0
        assert first_item.attributes["request_url"].string_value == "https://example.com"
        assert first_item.attributes["http_status_code"].int_value == 301
        assert first_item.attributes["request_duration_us"].int_value == 100000

        second_item = trace_items[1]
        assert second_item.attributes["request_sequence"].int_value == 1
        assert second_item.attributes["request_url"].string_value == "https://www.example.com"
        assert second_item.attributes["http_status_code"].int_value == 200
        assert second_item.attributes["request_duration_us"].int_value == 150000

    def test_convert_legacy_request_info_denormalized(self):
        result = self._create_base_result(
            region="us-west-2",
            request_info={
                "url": "https://example.com",
                "request_type": "GET",
                "http_status_code": 200,
                "request_duration_us": 150000,
            },
        )

        trace_items = convert_uptime_result_to_trace_items(self.project, result)

        assert len(trace_items) == 1
        trace_item = trace_items[0]
        assert trace_item.client_sample_rate == 1.0
        assert trace_item.server_sample_rate == 1.0
        attributes = trace_item.attributes

        assert attributes["check_status"].string_value == "success"
        assert attributes["region"].string_value == "us-west-2"

        assert attributes["request_sequence"].int_value == 0
        assert attributes["request_url"].string_value == "https://example.com"

    def test_convert_with_no_requests(self):
        """Test conversion when there are no requests to convert (e.g., missed_window status)."""
        result = self._create_base_result()  # Has request_info=None and no request_info_list

        trace_items = convert_uptime_result_to_trace_items(self.project, result)

        # Should return empty list when there are legitimately no requests to convert
        assert len(trace_items) == 0
