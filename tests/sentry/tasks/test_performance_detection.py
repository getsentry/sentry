import unittest
from unittest.mock import Mock, call, patch

from sentry.tasks.performance_detection import _detect_performance_issue, detect_performance_issue
from sentry.testutils.helpers import override_options
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


class PerformanceDetectionTest(unittest.TestCase):
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
                    100.0,
                )
            ]
            * 4,
        }
        duplicate_not_allowed_op_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder().with_op("random").with_description("example").build(),
                    100.0,
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
                    100.0,
                )
            ]
            * 5,
        }

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
        no_slow_span_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder()
                    .with_op("db")
                    .with_description("SELECT count() FROM table WHERE id = %s")
                    .build(),
                    499.0,
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
                    501.0,
                )
            ]
            * 1,
        }
        slow_not_allowed_op_span_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder().with_op("random").with_description("example").build(),
                    501.0,
                )
            ]
            * 1,
        }

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

    def test_calls_detect_sequential(self):
        no_sequential_event = {
            "event_id": "a" * 16,
            "spans": [
                modify_span_duration(
                    SpanBuilder()
                    .with_op("db")
                    .with_description("SELECT count() FROM table WHERE id = %s")
                    .build(),
                    499.0,
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
                    499.0,
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
                        499.0,
                    ),
                    1000.0,
                ),
                modify_span_start(
                    modify_span_duration(
                        SpanBuilder()
                        .with_op("db")
                        .with_description("SELECT count() FROM table WHERE id = %s")
                        .build(),
                        499.0,
                    ),
                    2000.0,
                ),
                modify_span_start(
                    modify_span_duration(
                        SpanBuilder()
                        .with_op("db")
                        .with_description("SELECT count() FROM table WHERE id = %s")
                        .build(),
                        499.0,
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

    def test_calls_detect_uncompressed_assets(self):
        def asset_event(transfer_size=0, encoded_body_size=0, decoded_body_size=0):
            return {
                "event_id": "a" * 16,
                "spans": [
                    modify_span_duration(
                        SpanBuilder()
                        .with_op("resource.script")
                        .with_description("https://example.com/app.js")
                        .with_data(
                            {
                                "Transfer Size": transfer_size,
                                "Encoded Body Size": encoded_body_size,
                                "Decoded Body Size": decoded_body_size,
                            }
                        )
                        .build(),
                        100.0,
                    )
                ],
            }

        insignificant_size_bytes = 500
        significant_size_bytes = 5 * 1024**2

        compressed_asset_event = asset_event(
            transfer_size=significant_size_bytes,
            encoded_body_size=significant_size_bytes,
            decoded_body_size=2 * significant_size_bytes,
        )
        small_uncompressed_asset_event = asset_event(
            transfer_size=insignificant_size_bytes,
            encoded_body_size=insignificant_size_bytes,
            decoded_body_size=insignificant_size_bytes,
        )
        cached_uncompressed_asset_event = asset_event(
            transfer_size=0,
            encoded_body_size=significant_size_bytes,
            decoded_body_size=significant_size_bytes,
        )
        uncompressed_asset_event = asset_event(
            transfer_size=significant_size_bytes,
            encoded_body_size=significant_size_bytes,
            decoded_body_size=significant_size_bytes,
        )

        sdk_span_mock = Mock()

        _detect_performance_issue(compressed_asset_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_issue(small_uncompressed_asset_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_issue(cached_uncompressed_asset_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_issue(uncompressed_asset_event, sdk_span_mock)
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
                    "_pi_uncompressed_asset",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )
