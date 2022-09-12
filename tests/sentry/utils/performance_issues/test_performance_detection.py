import os
import unittest
from unittest.mock import Mock, call, patch

from sentry.eventstore.models import Event
from sentry.testutils import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from sentry.utils import json
from sentry.utils.performance_issues.performance_detection import (
    DETECTOR_TYPE_TO_GROUP_TYPE,
    DetectorType,
    EventPerformanceProblem,
    PerformanceProblem,
    _detect_performance_problems,
    detect_performance_problems,
    prepare_problem_for_grouping,
)
from sentry.utils.performance_issues.performance_span_issue import PerformanceSpanProblem
from tests.sentry.spans.grouping.test_strategy import SpanBuilder

_fixture_path = os.path.join(os.path.dirname(__file__), "events")

EVENTS = {}
PROJECT_ID = 1

for filename in os.listdir(_fixture_path):
    if not filename.endswith(".json"):
        continue

    [event_name, _extension] = filename.split(".")

    with open(os.path.join(_fixture_path, filename)) as f:
        event = json.load(f)
        event["project"] = PROJECT_ID
        EVENTS[event_name] = event


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
    return {"event_id": event_id, "project": PROJECT_ID, "spans": spans}


class PerformanceDetectionTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        patch_project_option_get = patch("sentry.models.ProjectOption.objects.get_value")
        self.project_option_mock = patch_project_option_get.start()
        self.addCleanup(patch_project_option_get.stop)

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

    def test_project_option_overrides_default(self):
        n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        sdk_span_mock = Mock()

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)
        assert perf_problems == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-8d86357da4d8a866b19c97670edee38d037a7bc8",
                op="db",
                desc="SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
                parent_span_ids=["8dd7a5869a4f4583"],
                cause_span_ids=["9179e43ae844b174"],
                offender_span_ids=[
                    "b8be6138369491dd",
                    "b2d4826e7b618f1b",
                    "b3fdeea42536dbf1",
                    "b409e78a092e642f",
                    "86d2ede57bbf48d4",
                    "8e554c84cdc9731e",
                    "94d6230f3f910e12",
                    "a210b87a2191ceb6",
                    "88a5ccaf25b9bd8f",
                    "bb32cf50fc56b296",
                ],
            )
        ]

        self.project_option_mock.return_value = {
            "n_plus_one_db_duration_threshold": 100000,
        }

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)
        assert perf_problems == []

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

        _detect_performance_problems(duplicate_event, sdk_span_mock)
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
            "project": PROJECT_ID,
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
            "project": PROJECT_ID,
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
            "project": PROJECT_ID,
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
            "project": PROJECT_ID,
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

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 7
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    4,
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
                call(
                    "_pi_n_plus_one_db_fp",
                    "1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-8d86357da4d8a866b19c97670edee38d037a7bc8",
                ),
                call("_pi_n_plus_one_db", "b8be6138369491dd"),
            ]
        )
        assert perf_problems == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-8d86357da4d8a866b19c97670edee38d037a7bc8",
                op="db",
                desc="SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
                parent_span_ids=["8dd7a5869a4f4583"],
                cause_span_ids=["9179e43ae844b174"],
                offender_span_ids=[
                    "b8be6138369491dd",
                    "b2d4826e7b618f1b",
                    "b3fdeea42536dbf1",
                    "b409e78a092e642f",
                    "86d2ede57bbf48d4",
                    "8e554c84cdc9731e",
                    "94d6230f3f910e12",
                    "a210b87a2191ceb6",
                    "88a5ccaf25b9bd8f",
                    "bb32cf50fc56b296",
                ],
            )
        ]

    @patch("sentry.utils.metrics.incr")
    def test_does_not_report_metric_on_non_truncated_n_plus_one_query(self, incr_mock):
        n_plus_one_event = EVENTS["n-plus-one-in-django-new-view"]
        _detect_performance_problems(n_plus_one_event, Mock())
        unexpected_call = call("performance.performance_issue.truncated_np1_db")
        assert unexpected_call not in incr_mock.mock_calls

    def test_n_plus_one_db_detector_has_different_fingerprints_for_different_n_plus_one_events(
        self,
    ):
        index_n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        new_n_plus_one_event = EVENTS["n-plus-one-in-django-new-view"]

        sdk_span_mock = Mock()
        _detect_performance_problems(index_n_plus_one_event, sdk_span_mock)
        index_fingerprint = None
        for args in sdk_span_mock.containing_transaction.set_tag.call_args_list:
            if args[0][0] == "_pi_n_plus_one_db_fp":
                index_fingerprint = args[0][1]
        assert index_fingerprint

        sdk_span_mock.reset_mock()
        _detect_performance_problems(new_n_plus_one_event, sdk_span_mock)
        new_fingerprint = None
        for args in sdk_span_mock.containing_transaction.set_tag.call_args_list:
            if args[0][0] == "_pi_n_plus_one_db_fp":
                new_fingerprint = args[0][1]
        assert new_fingerprint

        assert index_fingerprint != new_fingerprint

    def test_ignores_fast_n_plus_one(self):
        fast_n_plus_one_event = EVENTS["fast-n-plus-one-in-django-new-view"]
        sdk_span_mock = Mock()

        _detect_performance_problems(fast_n_plus_one_event, sdk_span_mock)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0

    def test_finds_n_plus_one_with_db_dot_something_spans(self):
        activerecord_n_plus_one_event = EVENTS["n-plus-one-in-django-index-view-activerecord"]
        sdk_span_mock = Mock()

        _detect_performance_problems(activerecord_n_plus_one_event, sdk_span_mock)
        n_plus_one_fingerprint = None
        for args in sdk_span_mock.containing_transaction.set_tag.call_args_list:
            if args[0][0] == "_pi_n_plus_one_db_fp":
                n_plus_one_fingerprint = args[0][1]
        assert (
            n_plus_one_fingerprint
            == "1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-8d86357da4d8a866b19c97670edee38d037a7bc8"
        )

    def test_detects_slow_span_but_not_n_plus_one_in_query_waterfall(self):
        query_waterfall_event = EVENTS["query-waterfall-in-django-random-view"]
        sdk_span_mock = Mock()

        _detect_performance_problems(query_waterfall_event, sdk_span_mock)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 3
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    1,
                ),
                call("_pi_transaction", "ba9cf0e72b8c42439a6490be90d9733e"),
                call("_pi_slow_span", "870ada8266466319"),
            ]
        )

    def test_does_not_detect_n_plus_one_where_source_is_truncated(self):
        truncated_source_event = EVENTS["n-plus-one-in-django-new-view-truncated-source"]
        sdk_span_mock = Mock()

        _detect_performance_problems(truncated_source_event, sdk_span_mock)
        n_plus_one_fingerprint = None
        for args in sdk_span_mock.containing_transaction.set_tag.call_args_list:
            if args[0][0] == "_pi_n_plus_one_db_fp":
                n_plus_one_fingerprint = args[0][1]
        assert not n_plus_one_fingerprint

    @patch("sentry.utils.metrics.incr")
    def test_reports_metric_on_truncated_query_n_plus_one(self, incr_mock):
        truncated_source_event = EVENTS["n-plus-one-in-django-new-view-truncated-source"]
        _detect_performance_problems(truncated_source_event, Mock())
        incr_mock.assert_has_calls([call("performance.performance_issue.truncated_np1_db")])

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
            parent_span_ids=None,
            cause_span_ids=None,
            offender_span_ids=["b3fdeea42536dbf1", "b2d4826e7b618f1b"],
        )


@region_silo_test
class DetectorTypeToGroupTypeTest(unittest.TestCase):
    def test(self):
        # Make sure we don't forget to include a mapping to `GroupType`
        for detector_type in DetectorType:
            assert (
                detector_type in DETECTOR_TYPE_TO_GROUP_TYPE
            ), f"{detector_type} must have a corresponding entry in DETECTOR_TYPE_TO_GROUP_TYPE"


@region_silo_test
class EventPerformanceProblemTest(TestCase):
    def test_save_and_fetch(self):
        event = Event(self.project.id, "something")
        problem = PerformanceProblem(
            "test",
            "db",
            "something bad happened",
            GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
            ["1"],
            ["2", "3", "4"],
            ["4", "5", "6"],
        )

        EventPerformanceProblem(event, problem).save()
        assert EventPerformanceProblem.fetch(event, problem.fingerprint).problem == problem

    def test_fetch_multi(self):
        event_1 = Event(self.project.id, "something")
        event_1_problems = [
            PerformanceProblem(
                "test",
                "db",
                "something bad happened",
                GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
                ["1"],
                ["2", "3", "4"],
                ["4", "5", "6"],
            ),
            PerformanceProblem(
                "test_2",
                "db",
                "something horrible happened",
                GroupType.PERFORMANCE_SLOW_SPAN,
                ["234"],
                ["67", "87686", "786"],
                ["4", "5", "6"],
            ),
        ]
        event_2 = Event(self.project.id, "something else")
        event_2_problems = [
            PerformanceProblem(
                "event_2_test",
                "db",
                "something happened",
                GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
                ["1"],
                ["a", "b", "c"],
                ["d", "e", "f"],
            ),
            PerformanceProblem(
                "event_2_test_2",
                "db",
                "hello",
                GroupType.PERFORMANCE_SLOW_SPAN,
                ["234"],
                ["fdgh", "gdhgf", "gdgh"],
                ["gdf", "yu", "kjl"],
            ),
        ]
        all_event_problems = [
            (event, problem)
            for event, problems in ((event_1, event_1_problems), (event_2, event_2_problems))
            for problem in problems
        ]
        for event, problem in all_event_problems:
            EventPerformanceProblem(event, problem).save()

        unsaved_problem = PerformanceProblem(
            "fake_fingerprint",
            "db",
            "hello",
            GroupType.PERFORMANCE_SLOW_SPAN,
            ["234"],
            ["fdgh", "gdhgf", "gdgh"],
            ["gdf", "yu", "kjl"],
        )
        result = EventPerformanceProblem.fetch_multi(
            [
                (event, problem.fingerprint)
                for event, problem in all_event_problems + [(event, unsaved_problem)]
            ]
        )
        assert [r.problem if r else None for r in result] == [
            problem for _, problem in all_event_problems
        ] + [None]
        assert False
