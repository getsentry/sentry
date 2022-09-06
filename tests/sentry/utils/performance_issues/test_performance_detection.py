import os
import unittest
from unittest.mock import Mock, call, patch

from sentry.testutils.helpers import override_options
from sentry.types.issues import GroupType
from sentry.utils import json
from sentry.utils.performance_issues.performance_detection import (
    DETECTOR_TYPE_TO_GROUP_TYPE,
    DetectorType,
    PerformanceProblem,
    _detect_performance_problems,
    detect_performance_problems,
    prepare_problem_for_grouping,
)
from sentry.utils.performance_issues.performance_span_issue import PerformanceSpanProblem
from tests.sentry.spans.grouping.test_strategy import SpanBuilder

_fixture_path = os.path.join(os.path.dirname(__file__), "events")

EVENTS = {}

for filename in os.listdir(_fixture_path):
    if not filename.endswith(".json"):
        continue

    [event_name, _extension] = filename.split(".")

    with open(os.path.join(_fixture_path, filename)) as f:
        EVENTS[event_name] = json.load(f)


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


def create_span(op, duration=100.0, desc="SELECT count() FROM table WHERE id = %s", hash=""):
    return modify_span_duration(
        SpanBuilder().with_op(op).with_description(desc).with_hash(hash).build(),
        duration,
    )


def create_event(spans, event_id="a" * 16):
    return {"event_id": event_id, "spans": spans}


class PerformanceDetectionTest(unittest.TestCase):
    @patch("sentry.utils.performance_issues.performance_detection._detect_performance_problems")
    def test_options_disabled(self, mock):
        event = {}
        detect_performance_problems(event)
        assert mock.call_count == 0

    @patch("sentry.utils.performance_issues.performance_detection._detect_performance_problems")
    def test_options_enabled(self, mock):
        event = {}
        with override_options({"store.use-ingest-performance-detection-only": 1.0}):
            with override_options({"performance.issues.all.problem-detection": 1.0}):
                detect_performance_problems(event)
        assert mock.call_count == 1

    def test_calls_detect_duplicate(self):
        no_duplicate_event = create_event([create_span("db")] * 4)
        duplicate_not_allowed_op_event = create_event([create_span("random", 100.0)] * 5)
        duplicate_event = create_event([create_span("db")] * 5)

        sdk_span_mock = Mock()

        _detect_performance_problems(no_duplicate_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_problems(duplicate_not_allowed_op_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_problems(duplicate_event, sdk_span_mock)
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

    def test_calls_detect_duplicate_hash(self):
        no_duplicate_event = create_event(
            [create_span("http", 100.0, "http://example.com/slow?q=1", "")] * 4
            + [create_span("http", 100.0, "http://example.com/slow?q=2", "")]
        )
        duplicate_event = create_event(
            [create_span("http", 100.0, "http://example.com/slow?q=1", "abcdef")] * 4
            + [create_span("http", 100.0, "http://example.com/slow?q=2", "abcdef")]
        )

        sdk_span_mock = Mock()

        assert _detect_performance_problems(no_duplicate_event, sdk_span_mock) == []
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        perf_problems = _detect_performance_problems(duplicate_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 4
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
                    "_pi_dupes_hash_fp",
                    "abcdef",
                ),
                call(
                    "_pi_dupes_hash",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )
        assert perf_problems == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_DUPLICATE_SPANS-4691ce1ec85e08c8870ab4494afedfc86cdfc65d",
                op="http",
                desc="http://example.com/slow?q=1",
                type=GroupType.PERFORMANCE_DUPLICATE_SPANS,
                spans_involved=[
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                ],
            )
        ]

    def test_calls_detect_slow_span(self):
        no_slow_span_event = create_event([create_span("db", 999.0)] * 1)
        slow_span_event = create_event([create_span("db", 1001.0)] * 1)
        slow_not_allowed_op_span_event = create_event([create_span("random", 1001.0, "example")])

        sdk_span_mock = Mock()

        _detect_performance_problems(no_slow_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_problems(slow_not_allowed_op_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_problems(slow_span_event, sdk_span_mock)
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

        _detect_performance_problems(span_event, sdk_span_mock)
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

        _detect_performance_problems(http_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_problems(db_span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 3

    def test_calls_n_plus_one_spans_calls(self):
        # ├── GET list.json
        # │   ├── GET /events.json?q=1
        # │   ├──  GET /events.json?q=2
        # │   ├──   GET /events.json?q=3

        n_plus_one_event = create_event(
            [
                create_span("http.client", 250, "GET /list.json"),
                modify_span_start(
                    create_span("http.client", 180, "GET /events.json?q=1", "c0c0c0c0"), 101
                ),
                modify_span_start(
                    create_span("http.client", 178, "GET /events.json?q=2", "c0c0c0c0"), 105
                ),
                modify_span_start(
                    create_span("http.client", 163, "GET /events.json?q=3", "c0c0c0c0"), 109
                ),
            ]
        )

        sdk_span_mock = Mock()

        _detect_performance_problems(n_plus_one_event, sdk_span_mock)

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
                    "_pi_n_plus_one",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )

    def test_calls_detect_sequential(self):
        no_sequential_event = create_event([create_span("db", 999.0)] * 4)
        sequential_event = create_event(
            [create_span("db", 999.0)] * 2
            + [
                modify_span_start(create_span("db", 999.0), 1000.0),
                modify_span_start(create_span("db", 999.0), 2000.0),
                modify_span_start(create_span("db", 999.0), 3000.0),
            ]
        )

        sdk_span_mock = Mock()

        _detect_performance_problems(no_sequential_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_problems(sequential_event, sdk_span_mock)
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
        tolerable_long_task_spans_event = create_event(
            [create_span("ui.long-task", 50.0, "Long Task")] * 3, "a" * 16
        )
        long_task_span_event = create_event(
            [create_span("ui.long-task", 550.0, "Long Task")], "a" * 16
        )
        multiple_long_task_span_event = create_event(
            [create_span("ui.long-task", 50.0, "Long Task")] * 11, "c" * 16
        )

        sdk_span_mock = Mock()

        _detect_performance_problems(tolerable_long_task_spans_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_problems(long_task_span_event, sdk_span_mock)
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

        _detect_performance_problems(multiple_long_task_span_event, sdk_span_mock)
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

    def test_calls_detect_render_blocking_asset(self):
        render_blocking_asset_event = {
            "event_id": "a" * 16,
            "measurements": {
                "fcp": {
                    "value": 2500.0,
                    "unit": "millisecond",
                }
            },
            "spans": [
                create_span("resource.script", duration=1000.0),
            ],
        }
        non_render_blocking_asset_event = {
            "event_id": "a" * 16,
            "measurements": {
                "fcp": {
                    "value": 2500.0,
                    "unit": "millisecond",
                }
            },
            "spans": [
                modify_span_start(
                    create_span("resource.script", duration=1000.0),
                    2000.0,
                ),
            ],
        }
        no_fcp_event = {
            "event_id": "a" * 16,
            "measurements": {
                "fcp": {
                    "value": None,
                    "unit": "millisecond",
                }
            },
            "spans": [
                create_span("resource.script", duration=1000.0),
            ],
        }
        short_render_blocking_asset_event = {
            "event_id": "a" * 16,
            "measurements": {
                "fcp": {
                    "value": 2500.0,
                    "unit": "millisecond",
                }
            },
            "spans": [
                create_span("resource.script", duration=200.0),
            ],
        }

        sdk_span_mock = Mock()

        _detect_performance_problems(non_render_blocking_asset_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_problems(short_render_blocking_asset_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_problems(no_fcp_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

        _detect_performance_problems(render_blocking_asset_event, sdk_span_mock)
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
                    "_pi_render_blocking_assets",
                    "bbbbbbbbbbbbbbbb",
                ),
            ]
        )

    def test_does_not_detect_issues_in_fast_transaction(self):
        n_plus_one_event = EVENTS["no-issue-in-django-detail-view"]
        sdk_span_mock = Mock()

        _detect_performance_problems(n_plus_one_event, sdk_span_mock)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

    def test_detects_multiple_performance_issues_in_n_plus_one_query(self):
        n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        sdk_span_mock = Mock()

        _detect_performance_problems(n_plus_one_event, sdk_span_mock)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 5
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    3,
                ),
                call(
                    "_pi_transaction",
                    "da78af6000a6400aaa87cf6e14ddeb40",
                ),
                call(
                    "_pi_duplicates",
                    "86d2ede57bbf48d4",
                ),
                call("_pi_slow_span", "82428e8ef4c5a539"),
                call(
                    "_pi_sequential",
                    "b409e78a092e642f",
                ),
            ]
        )

    def test_detects_slow_span_in_solved_n_plus_one_query(self):
        n_plus_one_event = EVENTS["solved-n-plus-one-in-django-index-view"]
        sdk_span_mock = Mock()

        _detect_performance_problems(n_plus_one_event, sdk_span_mock)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 3
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    1,
                ),
                call("_pi_transaction", "4e7c82a05f514c93b6101d255ca14f89"),
                call("_pi_slow_span", "9f31e1ee4ef94970"),
            ]
        )


class PrepareProblemForGroupingTest(unittest.TestCase):
    def test(self):
        n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        assert prepare_problem_for_grouping(
            PerformanceSpanProblem(
                "97b250f72d59f230", "http.client", ["b3fdeea42536dbf1", "b2d4826e7b618f1b"], "hello"
            ),
            n_plus_one_event,
            DetectorType.N_PLUS_ONE_SPANS,
        ) == PerformanceProblem(
            fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE-562b149a55f0c195bd0a5fb5d7d9f9baea86ecea",
            op="db",
            type=GroupType.PERFORMANCE_N_PLUS_ONE,
            desc="SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
            spans_involved=["b3fdeea42536dbf1", "b2d4826e7b618f1b"],
        )


class DetectorTypeToGroupTypeTest(unittest.TestCase):
    def test(self):
        # Make sure we don't forget to include a mapping to `GroupType`
        for detector_type in DetectorType:
            assert (
                detector_type in DETECTOR_TYPE_TO_GROUP_TYPE
            ), f"{detector_type} must have a corresponding entry in DETECTOR_TYPE_TO_GROUP_TYPE"
