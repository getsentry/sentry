from __future__ import annotations

from unittest import mock

from sentry.spans.buffer import Span
from sentry.spans.debug_trace_logger import DebugTraceLogger
from sentry.testutils.helpers.options import override_options


def _make_span(
    span_id: str,
    parent_span_id: str | None = None,
    segment_id: str | None = None,
) -> Span:
    return Span(
        trace_id="a" * 32,
        span_id=span_id,
        parent_span_id=parent_span_id,
        segment_id=segment_id,
        project_id=123,
        payload=b"{}",
        end_timestamp=1000.0,
    )


class TestDebugTraceLogger:
    @mock.patch("sentry.spans.debug_trace_logger.logger")
    def test_logs_subsegment_info_with_no_span_keys(self, mock_logger):
        """Test logging when parent_span_id matches the only span's span_id."""
        mock_client = mock.MagicMock()

        with override_options({"spans.buffer.debug-traces": ["trace456"]}):
            debug_logger = DebugTraceLogger(mock_client)
            subsegment = [_make_span(span_id="abc123")]

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
        assert extra["sunion_span_key_count"] == 0
        assert extra["sunion_existing_key_count"] == 0
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

        with override_options({"spans.buffer.debug-traces": ["trace789"]}):
            debug_logger = DebugTraceLogger(mock_client)
            subsegment = [
                _make_span(span_id="parent123"),
                _make_span(span_id="child1", parent_span_id="parent123"),
                _make_span(span_id="child2", parent_span_id="parent123", segment_id="seg1"),
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
        assert extra["sunion_span_key_count"] == 2
        assert extra["sunion_existing_key_count"] == 1
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
        mock_pipeline.execute.return_value = [3]

        with override_options({"spans.buffer.debug-traces": ["trace222"]}):
            debug_logger = DebugTraceLogger(mock_client)
            subsegment = [
                _make_span(span_id="A"),
                _make_span(span_id="B", parent_span_id="A"),
            ]

            debug_logger.log_subsegment_info(
                project_and_trace="111:trace222",
                parent_span_id="A",
                subsegment=subsegment,
            )

        expected_key = b"span-buf:s:{111:trace222}:B"
        mock_pipeline.scard.assert_called_once_with(expected_key)

        extra = mock_logger.info.call_args[1]["extra"]
        assert "span-buf:s:{111:trace222}:B" in extra["set_sizes"]
        assert extra["set_sizes"]["span-buf:s:{111:trace222}:B"] == 3

    @mock.patch("sentry.spans.debug_trace_logger.logger")
    def test_subsegment_info_skips_when_trace_not_in_debug_traces(self, mock_logger):
        """Test that log_subsegment_info returns early when trace is not in debug_traces."""
        mock_client = mock.MagicMock()

        with override_options({"spans.buffer.debug-traces": []}):
            debug_logger = DebugTraceLogger(mock_client)
            subsegment = [_make_span(span_id="abc123")]

            debug_logger.log_subsegment_info(
                project_and_trace="123:trace456",
                parent_span_id="abc123",
                subsegment=subsegment,
            )

        mock_logger.info.assert_not_called()
        mock_client.pipeline.assert_not_called()

    @mock.patch("sentry.spans.debug_trace_logger.logger")
    def test_flush_info_with_root_span_flag(self, mock_logger):
        """Test log_flush_info when HRS flag is set."""
        mock_client = mock.MagicMock()
        mock_client.exists.return_value = 1
        mock_client.zscore.return_value = 1705320610

        with override_options({"spans.buffer.debug-traces": ["abcdef"]}):
            debug_logger = DebugTraceLogger(mock_client)
            segment_key = b"span-buf:s:{123:abcdef}:span1"
            queue_key = b"span-buf:q:0"
            now = 1705320600

            debug_logger.log_flush_info(
                segment_key=segment_key,
                segment_span_id="span1",
                root_span_in_segment=True,
                num_spans=5,
                shard_id=0,
                queue_key=queue_key,
                now=now,
            )

        assert mock_logger.info.call_count == 1
        call_args = mock_logger.info.call_args
        assert call_args[0][0] == "spans.buffer.debug_flush"

        extra = call_args[1]["extra"]
        assert extra["project_and_trace"] == "123:abcdef"
        assert extra["segment_span_id"] == "span1"
        assert extra["has_root_span_flag"] is True
        assert extra["root_span_in_segment"] is True
        assert extra["num_spans"] == 5
        assert extra["shard_id"] == 0
        assert extra["flusher_now"] == 1705320600
        assert extra["segment_deadline"] == 1705320610
        assert extra["ttl_remaining_seconds"] == 10

        mock_client.exists.assert_called_once_with(b"span-buf:hrs:" + segment_key)
        mock_client.zscore.assert_called_once_with(queue_key, segment_key)

    @mock.patch("sentry.spans.debug_trace_logger.logger")
    def test_flush_info_without_root_span_flag(self, mock_logger):
        """Test log_flush_info when HRS flag is not set."""
        mock_client = mock.MagicMock()
        mock_client.exists.return_value = 0
        mock_client.zscore.return_value = 1705320660

        with override_options({"spans.buffer.debug-traces": ["def789"]}):
            debug_logger = DebugTraceLogger(mock_client)
            segment_key = b"span-buf:s:{456:def789}:span2"
            queue_key = b"span-buf:q:7"
            now = 1705320600

            debug_logger.log_flush_info(
                segment_key=segment_key,
                segment_span_id="span2",
                root_span_in_segment=False,
                num_spans=3,
                shard_id=7,
                queue_key=queue_key,
                now=now,
            )

        assert mock_logger.info.call_count == 1
        extra = mock_logger.info.call_args[1]["extra"]
        assert extra["has_root_span_flag"] is False
        assert extra["root_span_in_segment"] is False
        assert extra["num_spans"] == 3
        assert extra["shard_id"] == 7
        assert extra["flusher_now"] == 1705320600
        assert extra["segment_deadline"] == 1705320660
        assert extra["ttl_remaining_seconds"] == 60

    @mock.patch("sentry.spans.debug_trace_logger.logger")
    def test_flush_info_skips_when_trace_not_in_debug_traces(self, mock_logger):
        """Test that log_flush_info returns early when trace is not in debug_traces."""
        mock_client = mock.MagicMock()

        with override_options({"spans.buffer.debug-traces": ["other_trace"]}):
            debug_logger = DebugTraceLogger(mock_client)
            segment_key = b"span-buf:s:{123:abcdef}:span1"
            queue_key = b"span-buf:q:0"
            now = 1705320600

            debug_logger.log_flush_info(
                segment_key=segment_key,
                segment_span_id="span1",
                root_span_in_segment=True,
                num_spans=5,
                shard_id=0,
                queue_key=queue_key,
                now=now,
            )

        mock_logger.info.assert_not_called()
        mock_client.exists.assert_not_called()
        mock_client.zscore.assert_not_called()
