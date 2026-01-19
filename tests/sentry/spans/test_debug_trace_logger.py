from __future__ import annotations

from typing import NamedTuple
from unittest import mock

from sentry.spans.debug_trace_logger import DebugTraceLogger


class MockSpan(NamedTuple):
    span_id: str
    parent_span_id: str | None
    segment_id: str | None


class TestDebugTraceLogger:

    @mock.patch("sentry.spans.debug_trace_logger.logger")
    def test_logs_subsegment_info_with_no_span_keys(self, mock_logger):
        """Test logging when parent_span_id matches the only span's span_id."""
        mock_client = mock.MagicMock()

        debug_logger = DebugTraceLogger(mock_client)
        subsegment = [MockSpan(span_id="abc123", parent_span_id=None, segment_id=None)]

        debug_logger.log_subsegment_info(
            project_and_trace="123:trace456",
            parent_span_id="abc123",
            subsegment=subsegment,
        )

        assert mock_logger.info.call_count == 1
        call_args = mock_logger.info.call_args
        assert call_args[0][0] == "spans.buffer.debug_subsegment"

        extra = call_args[1]["extra"]
        assert extra["project_and_trace"] == "123:trace456"
        assert extra["parent_span_id"] == "abc123"
        assert extra["num_spans_in_subsegment"] == 1
        assert extra["zunion_span_key_count"] == 0
        assert extra["zunion_existing_key_count"] == 0
        assert extra["set_sizes"] == {}
        assert extra["total_set_sizes"] == 0
        assert extra["subsegment_spans"] == [
            {"span_id": "abc123", "parent_span_id": None, "segment_id": None}
        ]

        mock_client.pipeline.assert_not_called()

    @mock.patch("sentry.spans.debug_trace_logger.logger")
    def test_logs_subsegment_info_with_span_keys(self, mock_logger):
        """Test logging with multiple spans where some have different span_ids."""
        mock_client = mock.MagicMock()
        mock_pipeline = mock.MagicMock()
        mock_client.pipeline.return_value.__enter__ = mock.MagicMock(return_value=mock_pipeline)
        mock_client.pipeline.return_value.__exit__ = mock.MagicMock(return_value=False)
        mock_pipeline.execute.return_value = [5, 0]

        debug_logger = DebugTraceLogger(mock_client)
        subsegment = [
            MockSpan(span_id="parent123", parent_span_id=None, segment_id=None),
            MockSpan(span_id="child1", parent_span_id="parent123", segment_id=None),
            MockSpan(span_id="child2", parent_span_id="parent123", segment_id="seg1"),
        ]

        debug_logger.log_subsegment_info(
            project_and_trace="456:trace789",
            parent_span_id="parent123",
            subsegment=subsegment,
        )

        assert mock_logger.info.call_count == 1
        call_args = mock_logger.info.call_args
        extra = call_args[1]["extra"]

        assert extra["project_and_trace"] == "456:trace789"
        assert extra["parent_span_id"] == "parent123"
        assert extra["num_spans_in_subsegment"] == 3
        assert extra["zunion_span_key_count"] == 2
        assert extra["zunion_existing_key_count"] == 1
        assert extra["total_set_sizes"] == 5
        assert len(extra["set_sizes"]) == 2
        assert len(extra["subsegment_spans"]) == 3

    @mock.patch("sentry.spans.debug_trace_logger.logger")
    def test_span_key_format(self, mock_logger):
        """Test that span keys are generated in the correct format."""
        mock_client = mock.MagicMock()
        mock_pipeline = mock.MagicMock()
        mock_client.pipeline.return_value.__enter__ = mock.MagicMock(return_value=mock_pipeline)
        mock_client.pipeline.return_value.__exit__ = mock.MagicMock(return_value=False)
        mock_pipeline.execute.return_value = [3]  # span B has 3 children

        debug_logger = DebugTraceLogger(mock_client)
        subsegment = [
            MockSpan(span_id="A", parent_span_id=None, segment_id=None),
            MockSpan(span_id="B", parent_span_id="A", segment_id=None),
        ]

        debug_logger.log_subsegment_info(
            project_and_trace="111:trace222",
            parent_span_id="A",
            subsegment=subsegment,
        )

        expected_key = b"span-buf:z:{111:trace222}:B"
        mock_pipeline.zcard.assert_called_once_with(expected_key)

        extra = mock_logger.info.call_args[1]["extra"]
        assert "span-buf:z:{111:trace222}:B" in extra["set_sizes"]
        assert extra["set_sizes"]["span-buf:z:{111:trace222}:B"] == 3
