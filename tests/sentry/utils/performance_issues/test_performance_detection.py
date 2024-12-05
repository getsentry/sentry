from __future__ import annotations

from unittest.mock import Mock, call, patch

import pytest

from sentry import projectoptions
from sentry.eventstore.models import Event
from sentry.issues.grouptype import (
    PerformanceConsecutiveHTTPQueriesGroupType,
    PerformanceNPlusOneGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.utils.performance_issues.base import DetectorType, total_span_time
from sentry.utils.performance_issues.detectors.n_plus_one_db_span_detector import (
    NPlusOneDBSpanDetector,
)
from sentry.utils.performance_issues.performance_detection import (
    EventPerformanceProblem,
    _detect_performance_problems,
    detect_performance_problems,
    get_detection_settings,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem

BASE_DETECTOR_OPTIONS = {
    "performance.issues.n_plus_one_db.problem-creation": 1.0,
    "performance.issues.n_plus_one_db_ext.problem-creation": 1.0,
}
BASE_DETECTOR_OPTIONS_OFF = {
    "performance.issues.n_plus_one_db.problem-creation": 0.0,
    "performance.issues.n_plus_one_db_ext.problem-creation": 0.0,
}


def assert_n_plus_one_db_problem(perf_problems):
    assert any(
        problem
        == PerformanceProblem(
            fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-8d86357da4d8a866b19c97670edee38d037a7bc8",
            op="db",
            desc="SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
            type=PerformanceNPlusOneGroupType,
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
            evidence_data={
                "op": "db",
                "parent_span_ids": ["8dd7a5869a4f4583"],
                "cause_span_ids": ["9179e43ae844b174"],
                "offender_span_ids": [
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
            },
            evidence_display=[],
        )
        for problem in perf_problems
    )


@pytest.mark.django_db
class PerformanceDetectionTest(TestCase):
    def setUp(self):
        super().setUp()
        patch_project_option_get = patch("sentry.models.ProjectOption.objects.get_value")
        self.project_option_mock = patch_project_option_get.start()
        self.project_option_mock.return_value = {}
        self.addCleanup(patch_project_option_get.stop)

        patch_project = patch("sentry.models.Project.objects.get_from_cache")
        self.project_mock = patch_project.start()
        self.addCleanup(patch_project.stop)

        patch_organization = patch("sentry.models.Organization.objects.get_from_cache")
        self.organization_mock = patch_organization.start()
        self.addCleanup(patch_organization.stop)

        self.project = self.create_project()

    @patch("sentry.utils.performance_issues.performance_detection._detect_performance_problems")
    def test_options_disabled(self, mock):
        with override_options({"performance.issues.all.problem-detection": 0.0}):
            detect_performance_problems({}, self.project)
            assert mock.call_count == 0

    @patch("sentry.utils.performance_issues.performance_detection._detect_performance_problems")
    def test_options_enabled(self, mock):
        detect_performance_problems({}, self.project)
        assert mock.call_count == 1

    @override_options(BASE_DETECTOR_OPTIONS)
    def test_detector_respects_project_option_settings(self):
        n_plus_one_event = get_event("n-plus-one-in-django-index-view")
        sdk_span_mock = Mock()

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock, self.project)
        assert_n_plus_one_db_problem(perf_problems)

        self.project_option_mock.return_value = {
            "n_plus_one_db_duration_threshold": 100000,
        }

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock, self.project)
        assert perf_problems == []

    def test_project_options_overrides_default_detection_settings(self):
        default_settings = get_detection_settings(self.project)

        assert default_settings[DetectorType.N_PLUS_ONE_DB_QUERIES]["detection_enabled"]
        assert default_settings[DetectorType.SLOW_DB_QUERY][0]["detection_enabled"]
        assert default_settings[DetectorType.CONSECUTIVE_DB_OP]["detection_enabled"]
        assert default_settings[DetectorType.CONSECUTIVE_HTTP_OP]["detection_enabled"]
        assert default_settings[DetectorType.DB_MAIN_THREAD][0]["detection_enabled"]
        assert default_settings[DetectorType.FILE_IO_MAIN_THREAD][0]["detection_enabled"]
        assert default_settings[DetectorType.M_N_PLUS_ONE_DB]["detection_enabled"]
        assert default_settings[DetectorType.N_PLUS_ONE_API_CALLS]["detection_enabled"]
        assert default_settings[DetectorType.CONSECUTIVE_HTTP_OP]["detection_enabled"]
        assert default_settings[DetectorType.LARGE_HTTP_PAYLOAD]["detection_enabled"]
        assert default_settings[DetectorType.RENDER_BLOCKING_ASSET_SPAN]["detection_enabled"]
        assert default_settings[DetectorType.UNCOMPRESSED_ASSETS]["detection_enabled"]

        self.project_option_mock.return_value = {
            "n_plus_one_db_queries_detection_enabled": False,
            "slow_db_queries_detection_enabled": False,
            "uncompressed_assets_detection_enabled": False,
            "consecutive_http_spans_detection_enabled": False,
            "large_http_payload_detection_enabled": False,
            "n_plus_one_api_calls_detection_enabled": False,
            "db_on_main_thread_detection_enabled": False,
            "file_io_on_main_thread_detection_enabled": False,
            "consecutive_db_queries_detection_enabled": False,
            "large_render_blocking_asset_detection_enabled": False,
        }

        configured_settings = get_detection_settings(self.project)

        assert not configured_settings[DetectorType.N_PLUS_ONE_DB_QUERIES]["detection_enabled"]
        assert not configured_settings[DetectorType.SLOW_DB_QUERY][0]["detection_enabled"]
        assert not configured_settings[DetectorType.CONSECUTIVE_DB_OP]["detection_enabled"]
        assert not configured_settings[DetectorType.CONSECUTIVE_HTTP_OP]["detection_enabled"]
        assert not configured_settings[DetectorType.DB_MAIN_THREAD][0]["detection_enabled"]
        assert not (configured_settings[DetectorType.FILE_IO_MAIN_THREAD][0]["detection_enabled"])
        assert not configured_settings[DetectorType.M_N_PLUS_ONE_DB]["detection_enabled"]
        assert not configured_settings[DetectorType.N_PLUS_ONE_API_CALLS]["detection_enabled"]
        assert not configured_settings[DetectorType.CONSECUTIVE_HTTP_OP]["detection_enabled"]
        assert not configured_settings[DetectorType.LARGE_HTTP_PAYLOAD]["detection_enabled"]
        assert not (
            configured_settings[DetectorType.RENDER_BLOCKING_ASSET_SPAN]["detection_enabled"]
        )
        assert not configured_settings[DetectorType.UNCOMPRESSED_ASSETS]["detection_enabled"]

    def test_project_options_overrides_default_threshold_settings(self):

        default_settings = get_detection_settings(self.project)

        assert default_settings[DetectorType.N_PLUS_ONE_DB_QUERIES]["duration_threshold"] == 50
        assert (
            default_settings[DetectorType.RENDER_BLOCKING_ASSET_SPAN]["fcp_ratio_threshold"] == 0.33
        )
        assert default_settings[DetectorType.DB_MAIN_THREAD][0]["duration_threshold"] == 16
        assert default_settings[DetectorType.FILE_IO_MAIN_THREAD][0]["duration_threshold"] == 16
        assert (
            default_settings[DetectorType.UNCOMPRESSED_ASSETS]["size_threshold_bytes"] == 500 * 1024
        )
        assert default_settings[DetectorType.UNCOMPRESSED_ASSETS]["duration_threshold"] == 300
        assert default_settings[DetectorType.CONSECUTIVE_DB_OP]["min_time_saved"] == 100
        assert default_settings[DetectorType.N_PLUS_ONE_API_CALLS]["total_duration"] == 300
        assert default_settings[DetectorType.LARGE_HTTP_PAYLOAD]["payload_size_threshold"] == 300000
        assert default_settings[DetectorType.CONSECUTIVE_HTTP_OP]["min_time_saved"] == 2000
        assert default_settings[DetectorType.SLOW_DB_QUERY][0]["duration_threshold"] == 500

        self.project_option_mock.return_value = {
            "n_plus_one_db_duration_threshold": 100000,
            "slow_db_query_duration_threshold": 5000,
            "render_blocking_fcp_ratio": 0.8,
            "large_http_payload_size_threshold": 7000000,
            "uncompressed_asset_size_threshold": 2000000,
            "uncompressed_asset_duration_threshold": 300,
            "db_on_main_thread_duration_threshold": 50,
            "file_io_on_main_thread_duration_threshold": 33,
            "consecutive_db_min_time_saved_threshold": 500,
            "n_plus_one_api_calls_total_duration_threshold": 500,
            "consecutive_http_spans_min_time_saved_threshold": 1000,
        }

        configured_settings = get_detection_settings(self.project)

        assert (
            configured_settings[DetectorType.N_PLUS_ONE_DB_QUERIES]["duration_threshold"] == 100000
        )
        assert configured_settings[DetectorType.N_PLUS_ONE_API_CALLS]["total_duration"] == 500
        assert configured_settings[DetectorType.SLOW_DB_QUERY][0]["duration_threshold"] == 5000
        assert (
            configured_settings[DetectorType.RENDER_BLOCKING_ASSET_SPAN]["fcp_ratio_threshold"]
            == 0.8
        )
        assert (
            configured_settings[DetectorType.UNCOMPRESSED_ASSETS]["size_threshold_bytes"] == 2000000
        )
        assert configured_settings[DetectorType.UNCOMPRESSED_ASSETS]["duration_threshold"] == 300
        assert (
            configured_settings[DetectorType.LARGE_HTTP_PAYLOAD]["payload_size_threshold"]
            == 7000000
        )
        assert configured_settings[DetectorType.DB_MAIN_THREAD][0]["duration_threshold"] == 50
        assert configured_settings[DetectorType.FILE_IO_MAIN_THREAD][0]["duration_threshold"] == 33
        assert configured_settings[DetectorType.CONSECUTIVE_DB_OP]["min_time_saved"] == 500
        assert configured_settings[DetectorType.CONSECUTIVE_HTTP_OP]["min_time_saved"] == 1000

    @override_options(BASE_DETECTOR_OPTIONS)
    def test_n_plus_one_extended_detection_no_parent_span(self):
        n_plus_one_event = get_event("n-plus-one-db-root-parent-span")
        sdk_span_mock = Mock()

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock, self.project)
        assert perf_problems == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-25f4aa547724c350ef3abdaef2cf78e62399f96e",
                op="db",
                desc="SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                type=PerformanceNPlusOneGroupType,
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
                evidence_data={
                    "op": "db",
                    "parent_span_ids": ["86d3f8a7e85d7324"],
                    "cause_span_ids": ["bc1f71fd71c8f594"],
                    "offender_span_ids": [
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
                },
                evidence_display=[],
            )
        ]

    @override_options(BASE_DETECTOR_OPTIONS)
    def test_overlap_detector_problems(self):
        n_plus_one_event = get_event("n-plus-one-db-root-parent-span")
        sdk_span_mock = Mock()

        n_plus_one_problems = _detect_performance_problems(
            n_plus_one_event, sdk_span_mock, self.project
        )

        assert len(n_plus_one_problems)

    @override_options(BASE_DETECTOR_OPTIONS_OFF)
    def test_system_option_disables_detector_issue_creation(self):
        n_plus_one_event = get_event("n-plus-one-in-django-index-view")
        sdk_span_mock = Mock()

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock, self.project)
        assert perf_problems == []

    @override_options({"performance.issues.consecutive_http.flag_disabled": True})
    def test_boolean_system_option_disables_detector_issue_creation(self):
        event = get_event("consecutive-http/consecutive-http-basic")
        sdk_span_mock = Mock()

        with self.feature("organizations:performance-consecutive-http-detector"):
            perf_problems = _detect_performance_problems(event, sdk_span_mock, self.project)
            assert perf_problems == []

    @override_options({"performance.issues.consecutive_http.flag_disabled": False})
    def test_boolean_system_option_enables_detector_issue_creation(self):
        event = get_event("consecutive-http/consecutive-http-basic")
        sdk_span_mock = Mock()

        with self.feature("organizations:performance-consecutive-http-detector"):
            perf_problems = _detect_performance_problems(event, sdk_span_mock, self.project)
            assert perf_problems == [
                PerformanceProblem(
                    fingerprint="1-1009-6654ad4d1d494222ce02c656386e6955575c17ed",
                    op="http",
                    desc="GET https://my-api.io/api/users?page=1",
                    type=PerformanceConsecutiveHTTPQueriesGroupType,
                    parent_span_ids=None,
                    cause_span_ids=[],
                    offender_span_ids=[
                        "96e0ae187b5481a1",
                        "8d22b49a27b18270",
                        "b2bc2ebb42248c74",
                        "9336922774fd35bc",
                        "a307ceb77c702cea",
                        "ac1e90ff646617e7",
                    ],
                    evidence_data={
                        "op": "http",
                        "parent_span_ids": None,
                        "cause_span_ids": [],
                        "offender_span_ids": [
                            "96e0ae187b5481a1",
                            "8d22b49a27b18270",
                            "b2bc2ebb42248c74",
                            "9336922774fd35bc",
                            "a307ceb77c702cea",
                            "ac1e90ff646617e7",
                        ],
                    },
                    evidence_display=[],
                )
            ]

    @override_options(BASE_DETECTOR_OPTIONS)
    def test_system_option_used_when_project_option_is_default(self):
        n_plus_one_event = get_event("n-plus-one-in-django-index-view")
        sdk_span_mock = Mock()

        self.project_option_mock.return_value = projectoptions.get_well_known_default(
            "sentry:performance_issue_settings", project=1
        )
        with override_options(
            {
                "performance.issues.n_plus_one_db.duration_threshold": 100000,
            }
        ):
            perf_problems = _detect_performance_problems(
                n_plus_one_event, sdk_span_mock, self.project
            )
            assert perf_problems == []

        with override_options(
            {
                "performance.issues.n_plus_one_db.duration_threshold": 100,
            }
        ):
            perf_problems = _detect_performance_problems(
                n_plus_one_event, sdk_span_mock, self.project
            )
            assert_n_plus_one_db_problem(perf_problems)

    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_respects_organization_creation_permissions(self):
        n_plus_one_event = get_event("n-plus-one-in-django-index-view")
        sdk_span_mock = Mock()

        with patch.object(
            NPlusOneDBSpanDetector, "is_creation_allowed_for_organization", return_value=False
        ):

            perf_problems = _detect_performance_problems(
                n_plus_one_event, sdk_span_mock, self.project
            )
            assert perf_problems == []

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock, self.project)
        assert_n_plus_one_db_problem(perf_problems)

    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_respects_project_creation_permissions(self):
        n_plus_one_event = get_event("n-plus-one-in-django-index-view")
        sdk_span_mock = Mock()

        with patch.object(
            NPlusOneDBSpanDetector, "is_creation_allowed_for_project", return_value=False
        ):

            perf_problems = _detect_performance_problems(
                n_plus_one_event, sdk_span_mock, self.project
            )
            assert perf_problems == []

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock, self.project)
        assert_n_plus_one_db_problem(perf_problems)

    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_detects_multiple_performance_issues_in_n_plus_one_query(self):
        n_plus_one_event = get_event("n-plus-one-in-django-index-view")
        sdk_span_mock = Mock()

        perf_problems = _detect_performance_problems(n_plus_one_event, sdk_span_mock, self.project)

        assert sdk_span_mock.containing_transaction.set_tag.call_count == 8
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call(
                    "_pi_all_issue_count",
                    2,
                ),
                call(
                    "_pi_sdk_name",
                    "",
                ),
                call("is_standalone_spans", False),
                call(
                    "_pi_transaction",
                    "da78af6000a6400aaa87cf6e14ddeb40",
                ),
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
        n_plus_one_event = get_event("n-plus-one-in-django-new-view")
        _detect_performance_problems(n_plus_one_event, Mock(), self.project)
        unexpected_call = call("performance.performance_issue.truncated_np1_db")
        assert unexpected_call not in incr_mock.mock_calls

    @patch("sentry.utils.metrics.incr")
    def test_reports_metric_on_truncated_query_n_plus_one(self, incr_mock):
        truncated_duplicates_event = get_event("n-plus-one-in-django-new-view-truncated-duplicates")
        _detect_performance_problems(truncated_duplicates_event, Mock(), self.project)
        incr_mock.assert_has_calls([call("performance.performance_issue.truncated_np1_db")])

    @patch("sentry.utils.metrics.incr")
    def test_reports_metrics_on_uncompressed_assets(self, incr_mock):
        event = get_event("uncompressed-assets/uncompressed-script-asset")
        _detect_performance_problems(event, Mock(), self.project)
        assert (
            call(
                "performance.performance_issue.uncompressed_assets",
                1,
                tags={"op_resource.script": True, "is_standalone_spans": False},
            )
            in incr_mock.mock_calls
        )
        detection_calls = [
            call
            for call in incr_mock.mock_calls
            if call.args[0] == "performance.performance_issue.detected"
        ]
        assert len(detection_calls) == 1
        tags = detection_calls[0].kwargs["tags"]

        assert tags["uncompressed_assets"]
        assert tags["sdk_name"] == "sentry.javascript.react"
        assert not tags["is_early_adopter"]
        assert tags["browser_name"] == "Chrome"

        # Ensure all other detections are set to false in tags
        pre_checked_keys = ["sdk_name", "is_early_adopter", "browser_name", "uncompressed_assets"]
        assert not any([v for k, v in tags.items() if k not in pre_checked_keys])


class EventPerformanceProblemTest(TestCase):
    def test_save_and_fetch(self):
        event = Event(self.project.id, "something")
        problem = PerformanceProblem(
            "test",
            "db",
            "something bad happened",
            PerformanceNPlusOneGroupType,
            ["1"],
            ["2", "3", "4"],
            ["4", "5", "6"],
            {},
            [],
        )

        EventPerformanceProblem(event, problem).save()
        found = EventPerformanceProblem.fetch(event, problem.fingerprint)
        assert found is not None
        assert found.problem == problem

    def test_fetch_multi(self):
        event_1 = Event(self.project.id, "something")
        event_1_problems = [
            PerformanceProblem(
                "test",
                "db",
                "something bad happened",
                PerformanceNPlusOneGroupType,
                ["1"],
                ["2", "3", "4"],
                ["4", "5", "6"],
                {},
                [],
            ),
            PerformanceProblem(
                "test_2",
                "db",
                "something horrible happened",
                PerformanceSlowDBQueryGroupType,
                ["234"],
                ["67", "87686", "786"],
                ["4", "5", "6"],
                {},
                [],
            ),
        ]
        event_2 = Event(self.project.id, "something else")
        event_2_problems = [
            PerformanceProblem(
                "event_2_test",
                "db",
                "something happened",
                PerformanceNPlusOneGroupType,
                ["1"],
                ["a", "b", "c"],
                ["d", "e", "f"],
                {},
                [],
            ),
            PerformanceProblem(
                "event_2_test_2",
                "db",
                "hello",
                PerformanceSlowDBQueryGroupType,
                ["234"],
                ["fdgh", "gdhgf", "gdgh"],
                ["gdf", "yu", "kjl"],
                {},
                [],
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
            PerformanceSlowDBQueryGroupType,
            ["234"],
            ["fdgh", "gdhgf", "gdgh"],
            ["gdf", "yu", "kjl"],
            {},
            [],
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
