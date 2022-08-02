from datetime import timedelta

from mock import Mock, call, patch

from sentry.tasks.performance_detection import _detect_performance_issue, detect_performance_issue
from sentry.testutils import TestCase
from sentry.testutils.helpers import override_options
from tests.sentry.spans.grouping.test_strategy import SpanBuilder


def modify_span_duration(obj, duration):
    obj["start_timestamp"] = timedelta(milliseconds=0)
    obj["timestamp"] = timedelta(milliseconds=duration)
    return obj


def modify_span_start(obj, start):
    duration = obj["timestamp"] - obj["start_timestamp"]
    obj["start_timestamp"] = timedelta(milliseconds=start)
    obj["timestamp"] = obj["start_timestamp"] + duration
    return obj


class PerformanceDetectionTest(TestCase):
    @patch("sentry.tasks.performance_detection._detect_performance_issue")
    def test_options_disabled(self, mock):
        event = {}
        detect_performance_issue(event)
        assert mock.call_count == 0

    @patch("sentry.tasks.performance_detection._detect_performance_issue")
    def test_options_enabled(self, mock):
        event = {}
        with override_options({"store.use-ingest-performance-detection-only": 1.0}):
            detect_performance_issue(event)
        assert mock.call_count == 1

    def test_calls_detect_duplicate(self):
        no_duplicate_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder()
                    .with_op("db")
                    .with_description("SELECT count() FROM table WHERE id = %s")
                    .build(),
                    100,
                )
            ]
            * 4,
        }
        duplicate_not_allowed_op_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder().with_op("random").with_description("example").build(),
                    100,
                )
            ]
            * 5,
        }

        duplicate_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder()
                    .with_op("db")
                    .with_description("SELECT count() FROM table WHERE id = %s")
                    .build(),
                    100,
                )
            ]
            * 5,
        }

        sdk_span_mock = Mock()

        _detect_performance_issue(no_duplicate_event, sdk_span_mock)
        assert sdk_span_mock.set_tag.call_count == 0
        assert sdk_span_mock.set_measurement.call_count == 0

        _detect_performance_issue(duplicate_not_allowed_op_event, sdk_span_mock)
        assert sdk_span_mock.set_tag.call_count == 0
        assert sdk_span_mock.set_measurement.call_count == 0

        _detect_performance_issue(duplicate_event, sdk_span_mock)
        assert sdk_span_mock.set_tag.call_count == 2
        sdk_span_mock.set_tag.assert_has_calls(
            [
                call(
                    "_performance_issue_transaction_id",
                    "aaaaaaaaaaaaaaaa",
                ),
                call(
                    "_performance_issue_duplicate_spans",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )
        assert sdk_span_mock.set_measurement.call_count == 1

    def test_calls_detect_slow_span(self):
        no_slow_span_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder()
                    .with_op("db")
                    .with_description("SELECT count() FROM table WHERE id = %s")
                    .build(),
                    499,
                )
            ]
            * 1,
        }
        slow_span_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder()
                    .with_op("db")
                    .with_description("SELECT count() FROM table WHERE id = %s")
                    .build(),
                    501,
                )
            ]
            * 1,
        }
        slow_not_allowed_op_span_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder().with_op("random").with_description("example").build(),
                    501,
                )
            ]
            * 1,
        }

        sdk_span_mock = Mock()

        _detect_performance_issue(no_slow_span_event, sdk_span_mock)
        assert sdk_span_mock.set_tag.call_count == 0
        assert sdk_span_mock.set_measurement.call_count == 0

        _detect_performance_issue(slow_not_allowed_op_span_event, sdk_span_mock)
        assert sdk_span_mock.set_tag.call_count == 0
        assert sdk_span_mock.set_measurement.call_count == 0

        _detect_performance_issue(slow_span_event, sdk_span_mock)
        assert sdk_span_mock.set_tag.call_count == 2
        sdk_span_mock.set_tag.assert_has_calls(
            [
                call(
                    "_performance_issue_transaction_id",
                    "aaaaaaaaaaaaaaaa",
                ),
                call(
                    "_performance_issue_slow_span",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )
        assert sdk_span_mock.set_measurement.call_count == 1

    def test_calls_detect_sequential(self):
        no_sequential_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder()
                    .with_op("db")
                    .with_description("SELECT count() FROM table WHERE id = %s")
                    .build(),
                    499,
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
                    499,
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
                        499,
                    ),
                    1000,
                ),
                modify_span_start(
                    modify_span_duration(
                        SpanBuilder()
                        .with_op("db")
                        .with_description("SELECT count() FROM table WHERE id = %s")
                        .build(),
                        499,
                    ),
                    2000,
                ),
                modify_span_start(
                    modify_span_duration(
                        SpanBuilder()
                        .with_op("db")
                        .with_description("SELECT count() FROM table WHERE id = %s")
                        .build(),
                        499,
                    ),
                    3000,
                ),
            ],
        }

        sdk_span_mock = Mock()

        _detect_performance_issue(no_sequential_event, sdk_span_mock)
        assert sdk_span_mock.set_tag.call_count == 0
        assert sdk_span_mock.set_measurement.call_count == 0

        _detect_performance_issue(sequential_event, sdk_span_mock)
        assert sdk_span_mock.set_tag.call_count == 3
        sdk_span_mock.set_tag.assert_has_calls(
            [
                call(
                    "_performance_issue_transaction_id",
                    "aaaaaaaaaaaaaaaa",
                ),
                call(
                    "_performance_issue_duplicate_spans",
                    "bbbbbbbbbbbbbbbb",
                ),
                call(
                    "_performance_issue_sequential_span",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )
        assert sdk_span_mock.set_measurement.call_count == 1
