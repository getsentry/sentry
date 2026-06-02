from __future__ import annotations

from unittest import mock
from unittest.mock import call

from sentry.spans.buffer_logger import (
    BufferLogger,
    DeadlineUpdateLog,
    FlusherAggregate,
    FlusherLogEntry,
    FlusherLogger,
    FlushSegmentLog,
    InsertSpansMetrics,
    SubsegmentDebugLog,
    emit_observability_metrics,
)
from sentry.spans.buffer_types import (
    EvalshaResult,
    FlushCandidate,
    InsertedSubsegment,
    LoadedSegment,
    Span,
    Subsegment,
)
from sentry.spans.segment_key import SegmentKey
from sentry.testutils.helpers.options import override_options


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def test_subsegment_debug_log_emits_debug_log() -> None:
    span = Span(
        trace_id="a" * 32,
        span_id="c" * 16,
        parent_span_id="b" * 16,
        segment_id=None,
        project_id=1,
        payload=b"{}",
    )
    debug_trace_logger = mock.Mock()

    SubsegmentDebugLog(
        project_and_trace=f"1:{'a' * 32}",
        parent_span_id="b" * 16,
        subsegment=[span],
    ).emit(lambda: debug_trace_logger)

    debug_trace_logger.log_subsegment_info.assert_called_once_with(
        f"1:{'a' * 32}", "b" * 16, [span]
    )


def test_insert_spans_metrics_emits_evalsha_data() -> None:
    insert_spans_metrics = InsertSpansMetrics()
    buffer_logger = mock.Mock()
    latency_metrics = [(b"step", 20.0)]
    gauge_metrics = [(b"gauge", 2.0)]

    insert_spans_metrics.record_evalsha_result(
        "1:" + "a" * 32,
        EvalshaResult(
            segment_key=_segment_id(1, "a" * 32, "a" * 16),
            has_root_span=False,
            latency_ms=5,
            latency_metrics=[(b"step", 5.0)],
            gauge_metrics=[(b"gauge", 1.0)],
        ),
    )
    insert_spans_metrics.record_evalsha_result(
        "1:" + "b" * 32,
        EvalshaResult(
            segment_key=_segment_id(1, "b" * 32, "b" * 16),
            has_root_span=True,
            latency_ms=20,
            latency_metrics=latency_metrics,
            gauge_metrics=gauge_metrics,
        ),
    )

    with mock.patch("sentry.spans.buffer_logger.emit_observability_metrics") as emit_metrics:
        buffer_logger.log(insert_spans_metrics.evalsha_latency_entries)
        insert_spans_metrics.emit_metrics()

    buffer_logger.log.assert_called_once_with([("1:" + "a" * 32, 5), ("1:" + "b" * 32, 20)])
    emit_metrics.assert_called_once_with(
        [[(b"step", 5.0)], latency_metrics],
        [[(b"gauge", 1.0)], gauge_metrics],
        (20, latency_metrics, gauge_metrics),
    )


def test_insert_spans_metrics_from_inserted_subsegments() -> None:
    trace_id = "a" * 32
    parent_span_id = "b" * 16
    project_and_trace = f"1:{trace_id}"
    subsegment = Subsegment(
        project_and_trace=project_and_trace,
        parent_span_id=parent_span_id,
        salt="salted",
        spans=[
            Span(
                trace_id=trace_id,
                span_id="c" * 16,
                parent_span_id=parent_span_id,
                segment_id=None,
                project_id=1,
                payload=b"{}",
            )
        ],
    )

    insert_spans_metrics = InsertSpansMetrics.from_inserted_subsegments(
        [
            InsertedSubsegment(
                subsegment,
                EvalshaResult(
                    segment_key=_segment_id(1, trace_id, parent_span_id),
                    has_root_span=True,
                    latency_ms=12,
                    latency_metrics=[(b"step", 12.0)],
                    gauge_metrics=[(b"gauge", 1.0)],
                ),
            )
        ]
    )

    assert insert_spans_metrics.evalsha_latency_entries == [(project_and_trace, 12)]


def test_deadline_update_log_reads_old_deadline_when_trace_is_enabled() -> None:
    segment_key = _segment_id(1, "a" * 32, "b" * 16)
    queue_key = b"span-buf:q:0"
    client = mock.Mock()
    client.zscore.return_value = 7
    debug_trace_logger = mock.Mock()
    debug_trace_logger._should_log_trace.return_value = True

    DeadlineUpdateLog(
        segment_key=segment_key,
        project_and_trace="1:" + "a" * 32,
        queue_key=queue_key,
        new_deadline=11,
        message_timestamp=1,
        has_root_span=True,
    ).emit(client, lambda: debug_trace_logger)

    client.zscore.assert_called_once_with(queue_key, segment_key)
    debug_trace_logger.log_deadline_update.assert_called_once_with(
        segment_key=segment_key,
        project_and_trace="1:" + "a" * 32,
        old_deadline=7,
        new_deadline=11,
        message_timestamp=1,
        has_root_span=True,
    )


def test_flush_segment_log_emits_debug_log() -> None:
    segment_key = _segment_id(1, "a" * 32, "b" * 16)
    debug_trace_logger = mock.Mock()

    FlushSegmentLog(
        segment_key=segment_key,
        segment_span_id="b" * 16,
        has_root_span=True,
        num_spans=2,
        shard=0,
        queue_key=b"span-buf:q:0",
        timestamp=11,
    ).emit(lambda: debug_trace_logger)

    debug_trace_logger.log_flush_info.assert_called_once_with(
        segment_key,
        "b" * 16,
        True,
        2,
        0,
        b"span-buf:q:0",
        11,
    )


@mock.patch("sentry.spans.buffer_logger.time")
def test_accumulates_batches_and_tracks_cumulative_latency(mock_time):
    """
    Test that batches are accumulated with cumulative latency tracking,
    and that trimming occurs when exceeding MAX_ENTRIES (1000).
    """
    with override_options({"spans.buffer.evalsha-cumulative-logger-enabled": True}):
        mock_time.time.return_value = 1000.0

        buffer_logger = BufferLogger()

        # Process first batch - all entries should be tracked
        buffer_logger.log(
            [
                ("project1:trace1", 50),
                ("project1:trace1", 150),
                ("project1:trace1", 200),
                ("project2:trace2", 120),
            ]
        )

        # Verify cumulative latency is tracked (50 + 150 + 200 = 400)
        project1 = buffer_logger._metrics_per_trace["project1:trace1"]
        project2 = buffer_logger._metrics_per_trace["project2:trace2"]
        assert project1.operation_count == 3
        assert project1.cumulative_latency_ms == 400
        assert project2.operation_count == 1
        assert project2.cumulative_latency_ms == 120

        buffer_logger.log([("project1:trace1", 180), ("project2:trace2", 80)])

        project1 = buffer_logger._metrics_per_trace["project1:trace1"]
        project2 = buffer_logger._metrics_per_trace["project2:trace2"]
        assert project1.operation_count == 4  # 400 + 180
        assert project1.cumulative_latency_ms == 580
        assert project2.operation_count == 2  # 120 + 80
        assert project2.cumulative_latency_ms == 200

        # Test trimming: add 1100 entries to exceed MAX_ENTRIES
        entries_to_add = []
        for i in range(1100):
            # Create entries with different latencies
            # Lower i values get higher latencies to test trimming
            latency = 1000 - i if i < 500 else 100
            entries_to_add.append((f"project{i}:trace{i}", latency))

        buffer_logger.log(entries_to_add)

        # Verify trimming occurred - should be exactly 1000 entries
        assert len(buffer_logger._metrics_per_trace) == 50

        assert "project0:trace0" in buffer_logger._metrics_per_trace
        assert "project10:trace10" in buffer_logger._metrics_per_trace

        # Verify low-latency entries from the end were removed
        assert "project1099:trace1099" not in buffer_logger._metrics_per_trace


@mock.patch("sentry.spans.buffer_logger.logger")
@mock.patch("sentry.spans.buffer_logger.time")
def test_logs_only_top_50_when_more_than_1000_traces(mock_time, mock_logger):
    """
    Test periodic logging (every 1 minute) of top 50 entries by cumulative latency,
    and verify dictionary is cleared after logging.
    """
    with override_options({"spans.buffer.evalsha-cumulative-logger-enabled": True}):
        mock_time.time.side_effect = [
            1000.0,  # Set _last_log_time on first log
            1000.0,
            1000.0,
            1061.0,
        ]

        buffer_logger = BufferLogger()

        buffer_logger.log([("high_project:trace", 150)] * 10)

        entries = [(f"project{i}:trace{i}", 100) for i in range(1000)]
        buffer_logger.log(entries)

        assert len(buffer_logger._metrics_per_trace) == 50

        buffer_logger.log([("trigger:trace", 50)])

        assert mock_logger.info.call_count == 1

        call_args = mock_logger.info.call_args
        assert call_args[0][0] == "spans.buffer.slow_evalsha_operations"
        extra = call_args[1]["extra"]

        entries_list = extra["top_slow_operations"]
        assert len(entries_list) == 50

        assert entries_list[0] == "high_project:trace:10:1500"

        assert extra["num_tracked_keys"] == 50

        assert len(buffer_logger._metrics_per_trace) == 0
        assert buffer_logger._last_log_time is None


@mock.patch("sentry.spans.buffer_logger.logger")
def test_no_logging_when_no_data(mock_logger):
    """Test that nothing is logged when tracked metrics are empty."""
    buffer_logger = BufferLogger()

    # Internal state check - no data
    assert len(buffer_logger._metrics_per_trace) == 0

    # Even if we somehow trigger the logging path, it should not log
    # This is testing the internal behavior, but we can't easily trigger
    # the logging path without going through log() method
    # So we just verify initial state
    assert mock_logger.info.call_count == 0


@mock.patch("sentry.spans.buffer_logger.time")
def test_flusher_logger_accumulates_segments_and_spans(mock_time):
    """
    Test that FlusherLogger accumulates segment count, span count, and bytes
    across multiple calls for the same trace, and tracks cumulative flush latency.
    """
    with override_options({"spans.buffer.flusher-cumulative-logger-enabled": True}):
        mock_time.time.return_value = 1000.0

        flusher_logger = FlusherLogger()

        flusher_logger._log_entries(
            [
                FlusherLogEntry("project1:trace1", 10, 500),
                FlusherLogEntry("project1:trace1", 20, 800),
                FlusherLogEntry("project2:trace2", 5, 200),
            ],
            load_ids_latency_ms=5,
            load_data_latency_ms=10,
            decompress_latency_ms=3,
        )

        project1 = flusher_logger._metrics_per_trace["project1:trace1"]
        project2 = flusher_logger._metrics_per_trace["project2:trace2"]
        assert project1.segment_count == 2
        assert project1.span_count == 30
        assert project1.bytes_flushed == 1300
        assert project2.segment_count == 1
        assert project2.span_count == 5
        assert project2.bytes_flushed == 200
        assert flusher_logger._cumulative_load_ids_latency_ms == 5
        assert flusher_logger._cumulative_load_data_latency_ms == 10
        assert flusher_logger._cumulative_decompress_latency_ms == 3

        flusher_logger._log_entries(
            [FlusherLogEntry("project1:trace1", 15, 600)],
            load_ids_latency_ms=3,
            load_data_latency_ms=7,
            decompress_latency_ms=2,
        )

        project1 = flusher_logger._metrics_per_trace["project1:trace1"]
        assert project1.segment_count == 3
        assert project1.span_count == 45
        assert project1.bytes_flushed == 1900
        assert flusher_logger._cumulative_load_ids_latency_ms == 8
        assert flusher_logger._cumulative_load_data_latency_ms == 17
        assert flusher_logger._cumulative_decompress_latency_ms == 5


@mock.patch("sentry.spans.buffer_logger.time")
def test_flusher_logger_records_loaded_segments(mock_time):
    with override_options({"spans.buffer.flusher-cumulative-logger-enabled": True}):
        mock_time.time.return_value = 1000.0
        flusher_logger = FlusherLogger()
        first_segment_key = _segment_id(1, "a" * 32, "b" * 16)
        second_segment_key = _segment_id(2, "c" * 32, "d" * 16)
        empty_segment_key = _segment_id(3, "e" * 32, "f" * 16)

        flusher_logger.log_loaded_segments(
            [
                LoadedSegment(
                    FlushCandidate(0, b"queue", first_segment_key, 5),
                    [b"first", b"second"],
                    [],
                ),
                LoadedSegment(
                    FlushCandidate(0, b"queue", empty_segment_key, 5),
                    [],
                    [],
                ),
                LoadedSegment(
                    FlushCandidate(0, b"queue", second_segment_key, 5),
                    [b"third"],
                    [],
                ),
            ],
            load_ids_latency_ms=5,
            load_data_latency_ms=10,
            decompress_latency_ms=3,
        )

        first_trace = flusher_logger._metrics_per_trace[f"1:{'a' * 32}"]
        second_trace = flusher_logger._metrics_per_trace[f"2:{'c' * 32}"]
        assert first_trace == FlusherAggregate(1, 2, len(b"first") + len(b"second"))
        assert second_trace == FlusherAggregate(1, 1, len(b"third"))
        assert f"3:{'e' * 32}" not in flusher_logger._metrics_per_trace
        assert flusher_logger._cumulative_load_ids_latency_ms == 5
        assert flusher_logger._cumulative_load_data_latency_ms == 10
        assert flusher_logger._cumulative_decompress_latency_ms == 3


@mock.patch("sentry.spans.buffer_logger.time")
def test_flusher_logger_prunes_to_top_50_by_bytes(mock_time):
    """
    Test that FlusherLogger prunes to top 50 entries by cumulative bytes
    when exceeding MAX_ENTRIES.
    """
    with override_options({"spans.buffer.flusher-cumulative-logger-enabled": True}):
        mock_time.time.return_value = 1000.0

        flusher_logger = FlusherLogger()

        entries = [FlusherLogEntry(f"project{i}:trace{i}", 10, 1000 - i) for i in range(500)]
        flusher_logger._log_entries(
            entries, load_ids_latency_ms=20, load_data_latency_ms=30, decompress_latency_ms=10
        )

        assert len(flusher_logger._metrics_per_trace) == 50
        assert "project0:trace0" in flusher_logger._metrics_per_trace
        assert "project49:trace49" in flusher_logger._metrics_per_trace
        assert "project50:trace50" not in flusher_logger._metrics_per_trace
        assert "project499:trace499" not in flusher_logger._metrics_per_trace


@mock.patch("sentry.spans.buffer_logger.logger")
@mock.patch("sentry.spans.buffer_logger.time")
def test_flusher_logger_logs_and_resets_after_interval(mock_time, mock_logger):
    """
    Test that FlusherLogger logs entries after the 60s interval and resets state,
    including cumulative flush latency as a top-level field.
    """
    with override_options({"spans.buffer.flusher-cumulative-logger-enabled": True}):
        mock_time.time.side_effect = [
            1000.0,
            1000.0,
            1061.0,
        ]

        flusher_logger = FlusherLogger()

        flusher_logger._log_entries(
            [
                FlusherLogEntry("project1:trace1", 10, 500),
                FlusherLogEntry("project2:trace2", 5, 200),
            ],
            load_ids_latency_ms=20,
            load_data_latency_ms=30,
            decompress_latency_ms=8,
        )

        assert mock_logger.info.call_count == 0

        flusher_logger._log_entries(
            [FlusherLogEntry("project1:trace1", 8, 400)],
            load_ids_latency_ms=10,
            load_data_latency_ms=20,
            decompress_latency_ms=5,
        )

        assert mock_logger.info.call_count == 1
        call_args = mock_logger.info.call_args
        assert call_args[0][0] == "spans.buffer.top_flush_operations_by_bytes"

        extra = call_args[1]["extra"]
        entries_list = extra["top_flush_operations"]
        assert len(entries_list) == 2
        assert entries_list[0] == "project1:trace1:2:18:900"
        assert entries_list[1] == "project2:trace2:1:5:200"
        assert extra["cumulative_load_ids_latency_ms"] == 30
        assert extra["cumulative_load_data_latency_ms"] == 50
        assert extra["cumulative_decompress_latency_ms"] == 13

        assert len(flusher_logger._metrics_per_trace) == 0
        assert flusher_logger._cumulative_load_ids_latency_ms == 0
        assert flusher_logger._cumulative_load_data_latency_ms == 0
        assert flusher_logger._cumulative_decompress_latency_ms == 0
        assert flusher_logger._last_log_time is None


class TestEmitObservabilityMetrics:
    def data(self):
        return {
            "latency_metrics": [
                [
                    [b"redirect_step_latency_ms", 1],
                    [b"sunionstore_args_step_latency_ms", 1],
                    [b"sunionstore_step_latency_ms", 2],
                    [b"arg_cleanup_step_latency_ms", 3],
                    [b"spop_step_latency_ms", 5],
                    [b"ingested_count_step_latency_ms", 8],
                    [b"total_step_latency_ms", 13],
                ],
                [
                    [b"redirect_step_latency_ms", 1],
                    [b"sunionstore_args_step_latency_ms", 1],
                    [b"ingested_count_step_latency_ms", 2],
                    [b"total_step_latency_ms", 3],
                ],
            ],
            "gauge_metrics": [
                [
                    [b"redirect_table_size", 1123],
                    [b"redirect_depth", 5],
                    [b"parent_span_set_before_size", 813],
                    [b"parent_span_set_after_size", 2134],
                    [b"spopcalls", 55],
                ],
                [
                    [b"redirect_table_size", 1123],
                    [b"redirect_depth", 5],
                    [b"parent_span_set_before_size", 813],
                    [b"parent_span_set_after_size", 2134],
                    [b"spopcalls", 55],
                ],
            ],
            "longest_evalsha_data": (
                13,
                [
                    [b"redirect_step_latency_ms", 1],
                    [b"sunionstore_args_step_latency_ms", 1],
                    [b"sunionstore_step_latency_ms", 2],
                    [b"arg_cleanup_step_latency_ms", 3],
                    [b"spop_step_latency_ms", 5],
                    [b"ingested_count_step_latency_ms", 8],
                    [b"total_step_latency_ms", 13],
                ],
                [
                    [b"redirect_table_size", 1123],
                    [b"redirect_depth", 5],
                    [b"parent_span_set_before_size", 813],
                    [b"parent_span_set_after_size", 2134],
                    [b"spopcalls", 55],
                ],
            ),
        }

    @mock.patch("sentry.spans.buffer_logger.metrics.timing")
    @mock.patch("sentry.spans.buffer_logger.metrics.gauge")
    @mock.patch("sentry.spans.buffer_logger.metrics.incr")
    def test_emit_observability_metrics(self, mock_incr, mock_gauge, mock_timing):
        emit_observability_metrics(
            latency_metrics=self.data()["latency_metrics"],
            gauge_metrics=self.data()["gauge_metrics"],
            longest_evalsha_data=self.data()["longest_evalsha_data"],
        )

        LE = "spans.buffer.process_spans.longest_evalsha.step_latency_ms"

        def t(stage):
            return {"stage": stage}

        mock_timing.assert_has_calls(
            [
                # Aggregated latency metrics (avg, min, max for each stage)
                call(
                    "spans.buffer.process_spans.avg_step_latency_ms",
                    1.0,
                    tags=t("redirect_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.min_step_latency_ms",
                    1,
                    tags=t("redirect_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.max_step_latency_ms",
                    1,
                    tags=t("redirect_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.avg_step_latency_ms",
                    1.0,
                    tags=t("sunionstore_args_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.min_step_latency_ms",
                    1,
                    tags=t("sunionstore_args_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.max_step_latency_ms",
                    1,
                    tags=t("sunionstore_args_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.avg_step_latency_ms",
                    2.0,
                    tags=t("sunionstore_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.min_step_latency_ms",
                    2,
                    tags=t("sunionstore_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.max_step_latency_ms",
                    2,
                    tags=t("sunionstore_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.avg_step_latency_ms",
                    3.0,
                    tags=t("arg_cleanup_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.min_step_latency_ms",
                    3,
                    tags=t("arg_cleanup_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.max_step_latency_ms",
                    3,
                    tags=t("arg_cleanup_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.avg_step_latency_ms",
                    5.0,
                    tags=t("spop_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.min_step_latency_ms",
                    5,
                    tags=t("spop_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.max_step_latency_ms",
                    5,
                    tags=t("spop_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.avg_step_latency_ms",
                    5.0,
                    tags=t("ingested_count_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.min_step_latency_ms",
                    2,
                    tags=t("ingested_count_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.max_step_latency_ms",
                    8,
                    tags=t("ingested_count_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.avg_step_latency_ms",
                    8.0,
                    tags=t("total_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.min_step_latency_ms",
                    3,
                    tags=t("total_step_latency_ms"),
                ),
                call(
                    "spans.buffer.process_spans.max_step_latency_ms",
                    13,
                    tags=t("total_step_latency_ms"),
                ),
                # Longest evalsha metrics
                call(LE, 1, tags=t("redirect_step_latency_ms")),
                call(LE, 1, tags=t("sunionstore_args_step_latency_ms")),
                call(LE, 2, tags=t("sunionstore_step_latency_ms")),
                call(LE, 3, tags=t("arg_cleanup_step_latency_ms")),
                call(LE, 5, tags=t("spop_step_latency_ms")),
                call(LE, 8, tags=t("ingested_count_step_latency_ms")),
                call(LE, 13, tags=t("total_step_latency_ms")),
            ]
        )

        LG = "spans.buffer.process_spans.longest_evalsha.gauge_metric"

        mock_gauge.assert_has_calls(
            [
                # Aggregated gauge metrics (avg, min, max for each stage)
                call("spans.buffer.avg_gauge_metric", 1123.0, tags=t("redirect_table_size")),
                call("spans.buffer.min_gauge_metric", 1123.0, tags=t("redirect_table_size")),
                call("spans.buffer.max_gauge_metric", 1123.0, tags=t("redirect_table_size")),
                call("spans.buffer.avg_gauge_metric", 5.0, tags=t("redirect_depth")),
                call("spans.buffer.min_gauge_metric", 5.0, tags=t("redirect_depth")),
                call("spans.buffer.max_gauge_metric", 5.0, tags=t("redirect_depth")),
                call("spans.buffer.avg_gauge_metric", 813.0, tags=t("parent_span_set_before_size")),
                call("spans.buffer.min_gauge_metric", 813.0, tags=t("parent_span_set_before_size")),
                call("spans.buffer.max_gauge_metric", 813.0, tags=t("parent_span_set_before_size")),
                call("spans.buffer.avg_gauge_metric", 2134.0, tags=t("parent_span_set_after_size")),
                call("spans.buffer.min_gauge_metric", 2134.0, tags=t("parent_span_set_after_size")),
                call("spans.buffer.max_gauge_metric", 2134.0, tags=t("parent_span_set_after_size")),
                call("spans.buffer.avg_gauge_metric", 55.0, tags=t("spopcalls")),
                call("spans.buffer.min_gauge_metric", 55.0, tags=t("spopcalls")),
                call("spans.buffer.max_gauge_metric", 55.0, tags=t("spopcalls")),
                # Longest evalsha gauge metrics
                call(LG, 1123.0, tags=t("redirect_table_size")),
                call(LG, 5.0, tags=t("redirect_depth")),
                call(LG, 813.0, tags=t("parent_span_set_before_size")),
                call(LG, 2134.0, tags=t("parent_span_set_after_size")),
                call(LG, 55.0, tags=t("spopcalls")),
            ]
        )

        # Size Bucket metrics (temporary)
        mock_incr.assert_has_calls(
            [
                call(
                    "spans.buffer.parent_span_set_after_size_bucket", 2, tags={"size": "2000-5000"}
                ),
            ]
        )

    @mock.patch("sentry.spans.buffer_logger.metrics.incr")
    def test_emit_observability_metrics_oversized_count_metric(self, mock_incr):
        emit_observability_metrics(
            latency_metrics=[[]],
            gauge_metrics=[
                [
                    (b"parent_span_set_already_oversized", 1.0),
                    (b"redirect_depth", 1.0),
                ],
            ],
            longest_evalsha_data=(0, [], []),
        )

        mock_incr.assert_called_once_with(
            "spans.buffer.process_spans.parent_span_set_already_oversized.count",
            amount=1,
        )
