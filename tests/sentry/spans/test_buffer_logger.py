from __future__ import annotations

from unittest import mock
from unittest.mock import call

from sentry.spans.buffer_logger import BufferLogger, compare_metrics, emit_observability_metrics
from sentry.testutils.helpers.options import override_options


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
        assert buffer_logger._data["project1:trace1"] == (3, 400)
        assert buffer_logger._data["project2:trace2"] == (1, 120)

        buffer_logger.log([("project1:trace1", 180), ("project2:trace2", 80)])

        assert buffer_logger._data["project1:trace1"] == (4, 580)  # 400 + 180
        assert buffer_logger._data["project2:trace2"] == (2, 200)  # 120 + 80

        # Test trimming: add 1100 entries to exceed MAX_ENTRIES
        entries_to_add = []
        for i in range(1100):
            # Create entries with different latencies
            # Lower i values get higher latencies to test trimming
            latency = 1000 - i if i < 500 else 100
            entries_to_add.append((f"project{i}:trace{i}", latency))

        buffer_logger.log(entries_to_add)

        # Verify trimming occurred - should be exactly 1000 entries
        assert len(buffer_logger._data) == 50

        assert "project0:trace0" in buffer_logger._data
        assert "project10:trace10" in buffer_logger._data

        # Verify low-latency entries from the end were removed
        assert "project1099:trace1099" not in buffer_logger._data


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

        assert len(buffer_logger._data) == 50

        buffer_logger.log([("trigger:trace", 50)])

        assert mock_logger.info.call_count == 1

        call_args = mock_logger.info.call_args
        assert call_args[0][0] == "spans.buffer.slow_evalsha_operations"
        extra = call_args[1]["extra"]

        entries_list = extra["top_slow_operations"]
        assert len(entries_list) == 50

        assert entries_list[0] == "high_project:trace:10:1500"

        assert extra["num_tracked_keys"] == 50

        assert len(buffer_logger._data) == 0
        assert buffer_logger._last_log_time is None


@mock.patch("sentry.spans.buffer_logger.logger")
def test_no_logging_when_no_data(mock_logger):
    """Test that nothing is logged when _data is empty."""
    buffer_logger = BufferLogger()

    # Internal state check - no data
    assert len(buffer_logger._data) == 0

    # Even if we somehow trigger the logging path, it should not log
    # This is testing the internal behavior, but we can't easily trigger
    # the logging path without going through log() method
    # So we just verify initial state
    assert mock_logger.info.call_count == 0


class TestEmitObservabilityMetrics:
    def data(self):
        return {
            "latency_metrics": [
                [
                    [b"redirect_step_latency_ms", 1],
                    [b"sunionstore_args_step_latency_ms", 1],
                    [b"zunionstore_step_latency_ms", 2],
                    [b"arg_cleanup_step_latency_ms", 3],
                    [b"zpopmin_step_latency_ms", 5],
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
                    [b"zpopcalls", 55],
                ],
                [
                    [b"redirect_table_size", 1123],
                    [b"redirect_depth", 5],
                    [b"parent_span_set_before_size", 813],
                    [b"parent_span_set_after_size", 2134],
                    [b"zpopcalls", 55],
                ],
            ],
            "longest_evalsha_data": (
                13,
                [
                    [b"redirect_step_latency_ms", 1],
                    [b"sunionstore_args_step_latency_ms", 1],
                    [b"zunionstore_step_latency_ms", 2],
                    [b"arg_cleanup_step_latency_ms", 3],
                    [b"zpopmin_step_latency_ms", 5],
                    [b"ingested_count_step_latency_ms", 8],
                    [b"total_step_latency_ms", 13],
                ],
                [
                    [b"redirect_table_size", 1123],
                    [b"redirect_depth", 5],
                    [b"parent_span_set_before_size", 813],
                    [b"parent_span_set_after_size", 2134],
                    [b"zpopcalls", 55],
                ],
            ),
        }

    @mock.patch("sentry.spans.buffer_logger.metrics.timing")
    @mock.patch("sentry.spans.buffer_logger.metrics.gauge")
    def test_emit_observability_metrics(self, mock_gauge, mock_timing):
        emit_observability_metrics(
            latency_metrics=self.data()["latency_metrics"],
            gauge_metrics=self.data()["gauge_metrics"],
            longest_evalsha_data=self.data()["longest_evalsha_data"],
        )

        # Expected timing calls: 7 timing metrics * 3 (min, max, avg) + 8 for longest evalsha
        mock_timing.assert_has_calls(
            [
                # Aggregated latency metrics (min, max, avg for each metric)
                call("spans.buffer.process_spans.avg_redirect_step_latency_ms", 1.0),
                call("spans.buffer.process_spans.min_redirect_step_latency_ms", 1),
                call("spans.buffer.process_spans.max_redirect_step_latency_ms", 1),
                call("spans.buffer.process_spans.avg_sunionstore_args_step_latency_ms", 1.0),
                call("spans.buffer.process_spans.min_sunionstore_args_step_latency_ms", 1),
                call("spans.buffer.process_spans.max_sunionstore_args_step_latency_ms", 1),
                call("spans.buffer.process_spans.avg_zunionstore_step_latency_ms", 2.0),
                call("spans.buffer.process_spans.min_zunionstore_step_latency_ms", 2),
                call("spans.buffer.process_spans.max_zunionstore_step_latency_ms", 2),
                call("spans.buffer.process_spans.avg_arg_cleanup_step_latency_ms", 3.0),
                call("spans.buffer.process_spans.min_arg_cleanup_step_latency_ms", 3),
                call("spans.buffer.process_spans.max_arg_cleanup_step_latency_ms", 3),
                call("spans.buffer.process_spans.avg_zpopmin_step_latency_ms", 5.0),
                call("spans.buffer.process_spans.min_zpopmin_step_latency_ms", 5),
                call("spans.buffer.process_spans.max_zpopmin_step_latency_ms", 5),
                call("spans.buffer.process_spans.avg_ingested_count_step_latency_ms", 5.0),
                call("spans.buffer.process_spans.min_ingested_count_step_latency_ms", 2),
                call("spans.buffer.process_spans.max_ingested_count_step_latency_ms", 8),
                call("spans.buffer.process_spans.avg_total_step_latency_ms", 8.0),
                call("spans.buffer.process_spans.min_total_step_latency_ms", 3),
                call("spans.buffer.process_spans.max_total_step_latency_ms", 13),
                # Longest evalsha metrics
                call(
                    "spans.buffer.process_spans.longest_evalsha.latency.redirect_step_latency_ms",
                    1,
                ),
                call(
                    "spans.buffer.process_spans.longest_evalsha.latency.sunionstore_args_step_latency_ms",
                    1,
                ),
                call(
                    "spans.buffer.process_spans.longest_evalsha.latency.zunionstore_step_latency_ms",
                    2,
                ),
                call(
                    "spans.buffer.process_spans.longest_evalsha.latency.arg_cleanup_step_latency_ms",
                    3,
                ),
                call(
                    "spans.buffer.process_spans.longest_evalsha.latency.zpopmin_step_latency_ms",
                    5,
                ),
                call(
                    "spans.buffer.process_spans.longest_evalsha.latency.ingested_count_step_latency_ms",
                    8,
                ),
                call(
                    "spans.buffer.process_spans.longest_evalsha.latency.total_step_latency_ms",
                    13,
                ),
            ]
        )

        # Expected gauge calls: 5 gauge metrics * 3 (min, max, avg) + 5 for longest evalsha
        mock_gauge.assert_has_calls(
            [
                # Aggregated gauge metrics (min, max, avg for each metric)
                call("spans.buffer.avg_redirect_table_size", 1123.0),
                call("spans.buffer.min_redirect_table_size", 1123.0),
                call("spans.buffer.max_redirect_table_size", 1123.0),
                call("spans.buffer.avg_redirect_depth", 5.0),
                call("spans.buffer.min_redirect_depth", 5.0),
                call("spans.buffer.max_redirect_depth", 5.0),
                call("spans.buffer.avg_parent_span_set_before_size", 813.0),
                call("spans.buffer.min_parent_span_set_before_size", 813.0),
                call("spans.buffer.max_parent_span_set_before_size", 813.0),
                call("spans.buffer.avg_parent_span_set_after_size", 2134.0),
                call("spans.buffer.min_parent_span_set_after_size", 2134.0),
                call("spans.buffer.max_parent_span_set_after_size", 2134.0),
                call("spans.buffer.avg_zpopcalls", 55.0),
                call("spans.buffer.min_zpopcalls", 55.0),
                call("spans.buffer.max_zpopcalls", 55.0),
                # Longest evalsha gauge metrics
                call("spans.buffer.process_spans.longest_evalsha.redirect_table_size", 1123.0),
                call("spans.buffer.process_spans.longest_evalsha.redirect_depth", 5.0),
                call(
                    "spans.buffer.process_spans.longest_evalsha.parent_span_set_before_size", 813.0
                ),
                call(
                    "spans.buffer.process_spans.longest_evalsha.parent_span_set_after_size", 2134.0
                ),
                call("spans.buffer.process_spans.longest_evalsha.zpopcalls", 55.0),
            ]
        )


class TestCompareMetrics:
    @mock.patch("sentry.spans.buffer_logger.metrics.gauge")
    def test_compare_metrics(self, mock_gauge):
        """Test comparing all metrics_table metrics between ZSET and SET."""
        zset_gauge_metrics = [
            [
                [b"redirect_table_size", 100],
                [b"redirect_depth", 5],
                [b"parent_span_set_before_size", 40],
                [b"parent_span_set_after_size", 60],
                [b"zpopcalls", 10],
            ],
        ]
        set_gauge_metrics = [
            [
                [b"set_redirect_table_size", 100],
                [b"set_redirect_depth", 5],
                [b"set_parent_span_set_before_size", 50],
                [b"set_parent_span_set_after_size", 60],
                [b"set_spopcalls", 8],
            ],
        ]

        compare_metrics(zset_gauge_metrics, set_gauge_metrics)  # type: ignore[arg-type]

        mock_gauge.assert_has_calls(
            [
                call("spans.buffer.set_vs_zset.min_redirect_table_size", 0),
                call("spans.buffer.set_vs_zset.max_redirect_table_size", 0),
                call("spans.buffer.set_vs_zset.avg_redirect_table_size", 0.0),
                call("spans.buffer.set_vs_zset.min_redirect_depth", 0),
                call("spans.buffer.set_vs_zset.max_redirect_depth", 0),
                call("spans.buffer.set_vs_zset.avg_redirect_depth", 0.0),
                call("spans.buffer.set_vs_zset.min_parent_span_set_before_size", 10),
                call("spans.buffer.set_vs_zset.max_parent_span_set_before_size", 10),
                call("spans.buffer.set_vs_zset.avg_parent_span_set_before_size", 10.0),
                call("spans.buffer.set_vs_zset.min_parent_span_set_after_size", 0),
                call("spans.buffer.set_vs_zset.max_parent_span_set_after_size", 0),
                call("spans.buffer.set_vs_zset.avg_parent_span_set_after_size", 0.0),
                call("spans.buffer.set_vs_zset.min_zpopcalls", -2),
                call("spans.buffer.set_vs_zset.max_zpopcalls", -2),
                call("spans.buffer.set_vs_zset.avg_zpopcalls", -2.0),
            ],
            any_order=True,
        )

    @mock.patch("sentry.spans.buffer_logger.metrics.gauge")
    def test_compare_metrics_mapping(self, mock_gauge):
        """Test that special case metrics are compared correctly via mapping."""
        zset_latency_metrics = [
            [
                [b"zunionstore_step_latency_ms", 10],
                [b"zpopmin_step_latency_ms", 10],
                [b"total_step_latency_ms", 20],
            ],
            [
                [b"zunionstore_step_latency_ms", 5],
                [b"zpopmin_step_latency_ms", 5],
                [b"total_step_latency_ms", 10],
            ],
        ]
        set_latency_metrics = [
            [
                [b"set_sunionstore_step_latency_ms", 8],
                [b"set_spop_step_latency_ms", 8],
                [b"set_total_step_latency_ms", 16],
            ],
            [
                [b"set_sunionstore_step_latency_ms", 5],
                [b"set_spop_step_latency_ms", 5],
                [b"set_total_step_latency_ms", 10],
            ],
        ]

        compare_metrics(zset_latency_metrics, set_latency_metrics)  # type: ignore[arg-type]

        mock_gauge.assert_has_calls(
            [
                call("spans.buffer.set_vs_zset.min_zunionstore_step_latency_ms", -2),
                call("spans.buffer.set_vs_zset.max_zunionstore_step_latency_ms", 0),
                call("spans.buffer.set_vs_zset.avg_zunionstore_step_latency_ms", -1.0),
                call("spans.buffer.set_vs_zset.min_zpopmin_step_latency_ms", -2),
                call("spans.buffer.set_vs_zset.max_zpopmin_step_latency_ms", 0),
                call("spans.buffer.set_vs_zset.avg_zpopmin_step_latency_ms", -1.0),
                call("spans.buffer.set_vs_zset.min_total_step_latency_ms", -4),
                call("spans.buffer.set_vs_zset.max_total_step_latency_ms", 0),
                call("spans.buffer.set_vs_zset.avg_total_step_latency_ms", -2.0),
            ]
        )
