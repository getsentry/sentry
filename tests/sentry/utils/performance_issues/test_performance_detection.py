import unittest
from unittest.mock import Mock, call, patch

from sentry.testutils.helpers import override_options
from sentry.utils.performance_issues.performance_detection import (
    _detect_performance_issue,
    detect_performance_issue,
)
from tests.sentry.spans.grouping.test_strategy import SpanBuilder


# Duration is in ms
def modify_span_duration(obj, duration):
    obj["start_timestamp"] = 0.0
    obj["timestamp"] = duration / 1000.0
    return obj


# Start is in ms
def modify_span_start(obj, start):
    duration = obj["timestamp"] - obj["start_timestamp"]
    obj["start_timestamp"] = start / 1000.0
    obj["timestamp"] = obj["start_timestamp"] + duration
    return obj


def create_span(op, duration=100.0, desc="SELECT count() FROM table WHERE id = %s"):
    return modify_span_duration(
        SpanBuilder().with_op(op).with_description(desc).build(),
        duration,
    )


def create_event(spans, event_id="a" * 16):
    return {"event_id": event_id, "spans": spans}


class PerformanceDetectionTest(unittest.TestCase):
    @patch("sentry.utils.performance_issues.performance_detection._detect_performance_issue")
    def test_options_disabled(self, mock):
        event = {}
        detect_performance_issue(event)
        assert mock.call_count == 0

    @patch("sentry.utils.performance_issues.performance_detection._detect_performance_issue")
    def test_options_enabled(self, mock):
        event = {}
        with override_options({"store.use-ingest-performance-detection-only": 1.0}):
            detect_performance_issue(event)
        assert mock.call_count == 1

    def test_calls_detect_duplicate(self):
        no_duplicate_event = create_event([create_span("db")] * 4)
        duplicate_not_allowed_op_event = create_event([create_span("random", 100.0)] * 5)
        duplicate_event = create_event([create_span("db")] * 5)

        sdk_span_mock = Mock()

        _detect_performance_issue(no_duplicate_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_issue(duplicate_not_allowed_op_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_issue(duplicate_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 3
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    1,
                ),
                call(
                    "_pi_transaction",
                    "aaaaaaaaaaaaaaaa",
                ),
                call(
                    "_pi_duplicates",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )

    def test_calls_detect_slow_span(self):
        no_slow_span_event = create_event([create_span("db", 999.0)] * 1)
        slow_span_event = create_event([create_span("db", 1001.0)] * 1)
        slow_not_allowed_op_span_event = create_event([create_span("random", 1001.0, "example")])

        sdk_span_mock = Mock()

        _detect_performance_issue(no_slow_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_issue(slow_not_allowed_op_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_issue(slow_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 3
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    1,
                ),
                call(
                    "_pi_transaction",
                    "aaaaaaaaaaaaaaaa",
                ),
                call(
                    "_pi_slow_span",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )

    def test_calls_partial_span_op_allowed(self):
        span_event = create_event([create_span("http.client", 2001.0, "http://example.com")] * 1)

        sdk_span_mock = Mock()

        _detect_performance_issue(span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 3
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    1,
                ),
                call(
                    "_pi_transaction",
                    "aaaaaaaaaaaaaaaa",
                ),
                call(
                    "_pi_slow_span",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )

    def test_calls_slow_span_threshold(self):
        http_span_event = create_event(
            [create_span("http.client", 1001.0, "http://example.com")] * 1
        )
        db_span_event = create_event([create_span("db.query", 1001.0)] * 1)

        sdk_span_mock = Mock()

        _detect_performance_issue(http_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_issue(db_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 3

    def test_calls_detect_sequential(self):
        no_sequential_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder()
                    .with_op("db")
                    .with_description("SELECT count() FROM table WHERE id = %s")
                    .build(),
                    999.0,
                )
            ]
            * 4,
        }
        sequential_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder()
                    .with_op("db")
                    .with_description("SELECT count() FROM table WHERE id = %s")
                    .build(),
                    999.0,
                ),
            ]
            * 2
            + [
                modify_span_start(
                    modify_span_duration(
                        SpanBuilder()
                        .with_op("db")
                        .with_description("SELECT count() FROM table WHERE id = %s")
                        .build(),
                        999.0,
                    ),
                    1000.0,
                ),
                modify_span_start(
                    modify_span_duration(
                        SpanBuilder()
                        .with_op("db")
                        .with_description("SELECT count() FROM table WHERE id = %s")
                        .build(),
                        999.0,
                    ),
                    2000.0,
                ),
                modify_span_start(
                    modify_span_duration(
                        SpanBuilder()
                        .with_op("db")
                        .with_description("SELECT count() FROM table WHERE id = %s")
                        .build(),
                        999.0,
                    ),
                    3000.0,
                ),
            ],
        }

        sdk_span_mock = Mock()

        _detect_performance_issue(no_sequential_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_issue(sequential_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 4
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    2,
                ),
                call(
                    "_pi_transaction",
                    "aaaaaaaaaaaaaaaa",
                ),
                call(
                    "_pi_duplicates",
                    "bbbbbbbbbbbbbbbb",
                ),
                call(
                    "_pi_sequential",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )

    def test_calls_detect_long_task(self):
        tolerable_long_task_spans_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder().with_op("ui.long-task").with_description("Long Task").build(),
                    50.0,
                )
            ]
            * 3,
        }

        long_task_span_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder().with_op("ui.long-task").with_description("Long Task").build(),
                    550.0,
                )
            ],
        }

        multiple_long_task_span_event = {
            "event_id": "c" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder().with_op("ui.long-task").with_description("Long Task").build(),
                    50.0,
                )
            ]
            * 11,
        }

        sdk_span_mock = Mock()

        _detect_performance_issue(tolerable_long_task_spans_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_issue(long_task_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 3
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    1,
                ),
                call(
                    "_pi_transaction",
                    "aaaaaaaaaaaaaaaa",
                ),
                call(
                    "_pi_long_task",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )

        sdk_span_mock.reset_mock()

        _detect_performance_issue(multiple_long_task_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 3
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    1,
                ),
                call(
                    "_pi_transaction",
                    "cccccccccccccccc",
                ),
                call(
                    "_pi_long_task",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )
