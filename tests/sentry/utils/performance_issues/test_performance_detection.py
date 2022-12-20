import unittest
from unittest.mock import Mock, call, patch

import pytest

from sentry import projectoptions
from sentry.eventstore.models import Event
from sentry.testutils import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.performance_issues.event_generators import EVENTS, create_event, create_span
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from sentry.utils.performance_issues.performance_detection import (
    DETECTOR_TYPE_TO_GROUP_TYPE,
    DetectorType,
    EventPerformanceProblem,
    PerformanceProblem,
    _detect_performance_problems,
    detect_performance_problems,
    prepare_problem_for_grouping,
    total_span_time,
)
from sentry.utils.performance_issues.performance_span_issue import PerformanceSpanProblem

BASE_DETECTOR_OPTIONS = {
    "performance.issues.n_plus_one_db.problem-creation": 1.0,
    "performance.issues.n_plus_one_db_ext.problem-creation": 1.0,
}
BASE_DETECTOR_OPTIONS_OFF = {
    "performance.issues.n_plus_one_db.problem-creation": 0.0,
    "performance.issues.n_plus_one_db_ext.problem-creation": 0.0,
}


def assert_n_plus_one_db_problem(perf_problems):
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


@pytest.mark.django_db
class PerformanceDetectionTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        patch_project_option_get = patch("sentry.models.ProjectOption.objects.get_value")
        self.project_option_mock = patch_project_option_get.start()
        self.addCleanup(patch_project_option_get.stop)

        patch_project = patch("sentry.models.Project.objects.get_from_cache")
        self.project_mock = patch_project.start()
        self.addCleanup(patch_project.stop)

        patch_organization = patch("sentry.models.Organization.objects.get_from_cache")
        self.organization_mock = patch_organization.start()
        self.addCleanup(patch_organization.stop)

        self.features = ["organizations:performance-issues-ingest"]

        def has_feature(feature, org):
            return feature in self.features

        patch_features = patch("sentry.features.has")
        self.features_mock = patch_features.start()
        self.features_mock.side_effect = has_feature
        self.addCleanup(patch_features.stop)

    @patch("sentry.utils.performance_issues.performance_detection._detect_performance_problems")
    def test_options_disabled(self, mock):
        event = {}
        detect_performance_problems(event)
        assert mock.call_count == 0

    @patch("sentry.utils.performance_issues.performance_detection._detect_performance_problems")
    def test_options_enabled(self, mock):
        event = {}
        with override_options({"performance.issues.all.problem-detection": 1.0}):
            detect_performance_problems(event)
        assert mock.call_count == 1

    @override_options(BASE_DETECTOR_OPTIONS)
    def test_project_option_overrides_default(self):
        n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        sdk_span_mock = Mock()

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)
        assert_n_plus_one_db_problem(perf_problems)

        self.project_option_mock.return_value = {
            "n_plus_one_db_duration_threshold": 100000,
        }

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)
        assert perf_problems == []

    @override_options(BASE_DETECTOR_OPTIONS)
    def test_n_plus_one_extended_detection_no_parent_span(self):
        n_plus_one_event = EVENTS["n-plus-one-db-root-parent-span"]
        sdk_span_mock = Mock()

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)
        assert perf_problems == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-25f4aa547724c350ef3abdaef2cf78e62399f96e",
                op="db",
                desc="SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
                parent_span_ids=["86d3f8a7e85d7324"],
                cause_span_ids=["bc1f71fd71c8f594"],
                offender_span_ids=[
                    "b150bdaa43ddec7c",
                    "968fdbd8bca7f2f6",
                    "b2d1eddd591d84ba",
                    "ae40cc8427bd68d2",
                    "9e902554055d3477",
                    "90302ecea560be76",
                    "a75f1cec8d07106f",
                    "8af15a555f92701e",
                    "9c3a569621230f03",
                    "8788fb3fc43ad948",
                ],
            )
        ]

    @override_options(BASE_DETECTOR_OPTIONS)
    def test_n_plus_one_extended_detection_matches_previous_group(self):
        n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        sdk_span_mock = Mock()

        with override_options({"performance.issues.n_plus_one_db.problem-creation": 0.0}):
            n_plus_one_extended_problems = _detect_performance_problems(
                n_plus_one_event, sdk_span_mock
            )

        with override_options({"performance.issues.n_plus_one_db_ext.problem-creation": 0.0}):
            n_plus_one_original_problems = _detect_performance_problems(
                n_plus_one_event, sdk_span_mock
            )

        assert n_plus_one_original_problems == n_plus_one_extended_problems

    @override_options(BASE_DETECTOR_OPTIONS)
    def test_overlap_detector_problems(self):
        n_plus_one_event = EVENTS["n-plus-one-db-root-parent-span"]
        sdk_span_mock = Mock()

        n_plus_one_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)

        assert len(n_plus_one_problems)

    @override_options(BASE_DETECTOR_OPTIONS)
    def test_no_feature_flag_disables_creation(self):
        self.features = []
        n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        sdk_span_mock = Mock()

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)
        assert perf_problems == []

    @override_options(BASE_DETECTOR_OPTIONS_OFF)
    def test_system_option_disables_detector_issue_creation(self):
        n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        sdk_span_mock = Mock()

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)
        assert perf_problems == []

    @override_options(BASE_DETECTOR_OPTIONS)
    def test_system_option_used_when_project_option_is_default(self):
        n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        sdk_span_mock = Mock()

        self.project_option_mock.return_value = projectoptions.get_well_known_default(
            "sentry:performance_issue_settings", project=1
        )
        with override_options(
            {
                "performance.issues.n_plus_one_db.count_threshold": 20,
                "performance.issues.n_plus_one_db.duration_threshold": 100,
            }
        ):
            perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)
            assert perf_problems == []

        with override_options(
            {
                "performance.issues.n_plus_one_db.count_threshold": 5,
                "performance.issues.n_plus_one_db.duration_threshold": 100,
            }
        ):
            perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)
            assert_n_plus_one_db_problem(perf_problems)

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
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 4
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    1,
                ),
                call(
                    "_pi_sdk_name",
                    "sentry.python",
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
        span_event = create_event(
            [create_span("db.query", 2001.0, "SELECT something FROM something_else")] * 1
        )

        sdk_span_mock = Mock()

        _detect_performance_problems(span_event, sdk_span_mock)
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 4
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    1,
                ),
                call(
                    "_pi_sdk_name",
                    "sentry.python",
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
        assert sdk_span_mock.containing_transaction.set_tag.call_count == 4

    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_detects_multiple_performance_issues_in_n_plus_one_query(self):
        n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        sdk_span_mock = Mock()

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 8
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    3,
                ),
                call(
                    "_pi_sdk_name",
                    "",
                ),
                call(
                    "_pi_transaction",
                    "da78af6000a6400aaa87cf6e14ddeb40",
                ),
                call("_pi_slow_span", "b33db57efd994615"),
                call(
                    "_pi_n_plus_one_db_fp",
                    "1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-8d86357da4d8a866b19c97670edee38d037a7bc8",
                ),
                call("_pi_n_plus_one_db", "b8be6138369491dd"),
                call(
                    "_pi_n_plus_one_db_ext_fp",
                    "1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-8d86357da4d8a866b19c97670edee38d037a7bc8",
                ),
                call("_pi_n_plus_one_db_ext", "b8be6138369491dd"),
            ],
        )
        assert_n_plus_one_db_problem(perf_problems)

    @patch("sentry.utils.metrics.incr")
    def test_does_not_report_metric_on_non_truncated_n_plus_one_query(self, incr_mock):
        n_plus_one_event = EVENTS["n-plus-one-in-django-new-view"]
        _detect_performance_problems(n_plus_one_event, Mock())
        unexpected_call = call("performance.performance_issue.truncated_np1_db")
        assert unexpected_call not in incr_mock.mock_calls

    @patch("sentry.utils.metrics.incr")
    def test_reports_metric_on_truncated_query_n_plus_one(self, incr_mock):
        truncated_duplicates_event = EVENTS["n-plus-one-in-django-new-view-truncated-duplicates"]
        _detect_performance_problems(truncated_duplicates_event, Mock())
        incr_mock.assert_has_calls([call("performance.performance_issue.truncated_np1_db")])

    def test_detects_slow_span_in_solved_n_plus_one_query(self):
        n_plus_one_event = EVENTS["solved-n-plus-one-in-django-index-view"]
        sdk_span_mock = Mock()

        _detect_performance_problems(n_plus_one_event, sdk_span_mock)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 4
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    1,
                ),
                call(
                    "_pi_sdk_name",
                    "",
                ),
                call("_pi_transaction", "4e7c82a05f514c93b6101d255ca14f89"),
                call("_pi_slow_span", "a05754d3fde2db29"),
            ]
        )

    def test_detects_file_io_main_thread(self):
        file_io_event = EVENTS["file-io-on-main-thread"]
        sdk_span_mock = Mock()

        _detect_performance_problems(file_io_event, sdk_span_mock)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 5
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call("_pi_all_issue_count", 1),
                call("_pi_sdk_name", "sentry.java.android.timber"),
                call("_pi_transaction", "c119e45a9d724b1891df4651ebf9e6db"),
                call(
                    "_pi_file_io_main_thread_fp",
                    "1-GroupType.PERFORMANCE_FILE_IO_MAIN_THREAD-153198dd61706844cf3d9a922f6f82543df8125f",
                ),
                call("_pi_file_io_main_thread", "054ba3a374d543eb"),
            ]
        )

    def test_does_not_detect_file_io_main_thread(self):
        file_io_event = EVENTS["file-io-on-main-thread"]
        file_io_event["spans"][0]["data"]["blocked_main_thread"] = False
        sdk_span_mock = Mock()

        _detect_performance_problems(file_io_event, sdk_span_mock)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 0


class PrepareProblemForGroupingTest(unittest.TestCase):
    def test(self):
        n_plus_one_event = EVENTS["n-plus-one-in-django-index-view"]
        assert prepare_problem_for_grouping(
            PerformanceSpanProblem(
                "97b250f72d59f230", "http.client", ["b3fdeea42536dbf1", "b2d4826e7b618f1b"], "hello"
            ),
            n_plus_one_event,
            DetectorType.N_PLUS_ONE_DB_QUERIES,
        ) == PerformanceProblem(
            fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-562b149a55f0c195bd0a5fb5d7d9f9baea86ecea",
            op="db",
            type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
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


@pytest.mark.parametrize(
    "spans, duration",
    [
        pytest.param(
            [
                {
                    "start_timestamp": 0,
                    "timestamp": 0.011,
                }
            ],
            11,
        ),
        pytest.param(
            [
                {
                    "start_timestamp": 0,
                    "timestamp": 0.011,
                },
                {
                    "start_timestamp": 0,
                    "timestamp": 0.011,
                },
            ],
            11,
            id="parallel spans",
        ),
        pytest.param(
            [
                {
                    "start_timestamp": 0,
                    "timestamp": 0.011,
                },
                {
                    "start_timestamp": 1.0,
                    "timestamp": 1.011,
                },
            ],
            22,
            id="separate spans",
        ),
        pytest.param(
            [
                {
                    "start_timestamp": 0,
                    "timestamp": 0.011,
                },
                {
                    "start_timestamp": 0.005,
                    "timestamp": 0.016,
                },
            ],
            16,
            id="overlapping spans",
        ),
        pytest.param(
            [
                {
                    "start_timestamp": 0,
                    "timestamp": 0.011,
                },
                {
                    "start_timestamp": 0.005,
                    "timestamp": 0.016,
                },
                {
                    "start_timestamp": 0.015,
                    "timestamp": 0.032,
                },
            ],
            32,
            id="multiple overlapping spans",
        ),
        pytest.param(
            [
                {
                    "start_timestamp": 0,
                    "timestamp": 0.011,
                },
                {
                    "start_timestamp": 0.011,
                    "timestamp": 0.022,
                },
                {
                    "start_timestamp": 0.022,
                    "timestamp": 0.033,
                },
            ],
            33,
            id="multiple overlapping touching spans",
        ),
        pytest.param(
            [
                {
                    "start_timestamp": 0,
                    "timestamp": 0.011,
                },
                {
                    "start_timestamp": 0.005,
                    "timestamp": 0.022,
                },
                {
                    "start_timestamp": 0.033,
                    "timestamp": 0.045,
                },
                {
                    "start_timestamp": 0.045,
                    "timestamp": 0.055,
                },
            ],
            44,
            id="multiple overlapping spans with gaps",
        ),
    ],
)
def test_total_span_time(spans, duration):
    assert total_span_time(spans) == pytest.approx(duration, 0.01)
