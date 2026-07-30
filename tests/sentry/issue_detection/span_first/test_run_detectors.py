from __future__ import annotations

from collections import defaultdict
from typing import Any
from unittest.mock import ANY, patch

import pytest

from sentry.issue_detection.base import DetectorType
from sentry.issue_detection.detectors.span_first.base import SpanFirstDetector
from sentry.issue_detection.detectors.span_first.run_detectors import (
    _are_equivalent_lists,
    _collect_single_problem_diffs,
    _compare_problem_sets,
    compare_span_first_problems_to_control_data,
    run_detector,
    run_span_first_detectors,
)
from sentry.issue_detection.performance_problem import PerformanceProblem, PerformanceProblemDict
from sentry.issue_detection.types import StandaloneSpan
from sentry.issues.grouptype import (
    GroupType,
    PerformanceConsecutiveDBQueriesGroupType,
    PerformanceNPlusOneAPICallsGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.testutils.cases import TestCase
from sentry.testutils.issue_detection.segment_span_generators import (
    create_child_span,
    create_segment,
)
from sentry.testutils.pytest.mocking import count_matching_calls

CONSECUTIVE_DB_GROUPTYPE = PerformanceConsecutiveDBQueriesGroupType
N_PLUS_ONE_API_GROUPTYPE = PerformanceNPlusOneAPICallsGroupType
SLOW_DB_GROUPTYPE = PerformanceSlowDBQueryGroupType

CONSECUTIVE_DB_SLUG = CONSECUTIVE_DB_GROUPTYPE.slug
N_PLUS_ONE_API_SLUG = N_PLUS_ONE_API_GROUPTYPE.slug
SLOW_DB_SLUG = SLOW_DB_GROUPTYPE.slug

CONSECUTIVE_DB_FINGERPRINT = "consecutive-db-fingerprint"
N_PLUS_ONE_API_FINGERPRINT = "n-plus-one-fingerprint"
SLOW_DB_FINGERPRINT = "slow-db-fingerprint"
FINGERPRINTS_BY_GROUPTYPE = {
    CONSECUTIVE_DB_GROUPTYPE: CONSECUTIVE_DB_FINGERPRINT,
    N_PLUS_ONE_API_GROUPTYPE: N_PLUS_ONE_API_FINGERPRINT,
    SLOW_DB_GROUPTYPE: SLOW_DB_FINGERPRINT,
}


def make_problem(
    grouptype: type[GroupType],
    *,
    op: str = "db",
    desc: str = "test problem",
    fingerprint: str | None = None,
    parent_span_ids: list[str] | None = None,
    cause_span_ids: list[str] | None = None,
    offender_span_ids: list[str] | None = None,
    evidence_data: dict[str, Any] | None = None,
    evidence_display: list[IssueEvidence] | None = None,
) -> PerformanceProblem:
    return PerformanceProblem(
        op=op,
        desc=desc,
        type=grouptype,
        fingerprint=fingerprint or FINGERPRINTS_BY_GROUPTYPE[grouptype],
        parent_span_ids=parent_span_ids or [],
        cause_span_ids=cause_span_ids or [],
        offender_span_ids=offender_span_ids or [],
        evidence_data=evidence_data or {},
        evidence_display=evidence_display or [],
    )


def make_problem_dict(*args: Any, **kwargs: Any) -> PerformanceProblemDict:
    return make_problem(*args, **kwargs).to_dict()


class MockSlowDBDetector(SpanFirstDetector):
    type = DetectorType.SLOW_DB_QUERY
    grouptype = SLOW_DB_GROUPTYPE

    def visit_span(self, span: StandaloneSpan) -> None:
        # No-op: this stub emits its problem in `on_complete`.
        pass

    def on_complete(self) -> None:
        problem = make_problem(SLOW_DB_GROUPTYPE)
        self.stored_problems[problem.fingerprint] = problem


class MockNPlusOneAPIDetector(SpanFirstDetector):
    type = DetectorType.N_PLUS_ONE_API_CALLS
    grouptype = N_PLUS_ONE_API_GROUPTYPE

    def visit_span(self, span: StandaloneSpan) -> None:
        # No-op: this stub emits its problem in `on_complete`.
        pass

    def on_complete(self) -> None:
        problem = make_problem(N_PLUS_ONE_API_GROUPTYPE)
        self.stored_problems[problem.fingerprint] = problem


@pytest.mark.django_db
class RunDetectorTest(TestCase):
    def test_returns_problems_emitted_by_the_detector(self) -> None:
        segment = create_segment([create_child_span(op="db", duration=1001)])

        result = run_detector(MockSlowDBDetector, {"detection_enabled": True}, segment[0], segment)

        assert len(result) == 1
        assert result[0].fingerprint == SLOW_DB_FINGERPRINT

    def test_returns_empty_list_when_creation_is_disallowed(self) -> None:
        segment = create_segment([create_child_span(op="db", duration=1001)])

        result = run_detector(MockSlowDBDetector, {"detection_enabled": False}, segment[0], segment)

        assert len(result) == 0


@pytest.mark.django_db
class RunSpanFirstDetectorsTest(TestCase):
    def test_returns_problems_bucketed_by_grouptype_slug(self) -> None:
        # Each of our two mock detectors unconditionally creates a problem, so we don't need real
        # data here
        dummy_segment = create_segment([])

        # Replace the registered detectors with stubs producing two different group types, so we
        # can verify the bucketing without depending on whichever real detectors are wired up.
        mock_registry = {
            SLOW_DB_SLUG: [MockSlowDBDetector],
            N_PLUS_ONE_API_SLUG: [MockNPlusOneAPIDetector],
        }
        with patch.dict(
            "sentry.issue_detection.detectors.span_first.run_detectors.SPAN_FIRST_DETECTORS_BY_GROUPTYPE",
            mock_registry,
            clear=True,
        ):
            span_first_problems_by_grouptype = run_span_first_detectors(
                [SLOW_DB_SLUG, N_PLUS_ONE_API_SLUG],
                dummy_segment[0],
                dummy_segment,
                self.project,
            )

            assert set(span_first_problems_by_grouptype.keys()) == {
                SLOW_DB_SLUG,
                N_PLUS_ONE_API_SLUG,
            }

            slow_db_problems = span_first_problems_by_grouptype[SLOW_DB_SLUG]
            n_plus_one_problems = span_first_problems_by_grouptype[N_PLUS_ONE_API_SLUG]
            assert [p.fingerprint for p in slow_db_problems] == [SLOW_DB_FINGERPRINT]
            assert [p.fingerprint for p in n_plus_one_problems] == [N_PLUS_ONE_API_FINGERPRINT]


class CompareSpanFirstProblemsToControlDataTest(TestCase):
    def _get_base_debug_context(self) -> dict[str, Any]:
        return {
            "org_slug": self.project.organization.slug,
            "project_id": self.project.id,
            "project_slug": self.project.slug,
        }

    def _get_base_compare_kwargs(self) -> dict[str, Any]:
        return {
            "is_experimental_data_nullish": False,
            "source_of_truth": "neither",
            "metric_sample_rate": 1.0,
            # Lambdas won't compare equal; we'll verify these separately (the comparator by running
            # it and the serializer by seeing what gets logged)
            "exact_match_comparator": ANY,
            "data_serializer": ANY,
        }

    def test_compares_problems_for_each_grouptype(self) -> None:
        span_first_slow_db_problems = [
            make_problem(SLOW_DB_GROUPTYPE, desc="span-first db desc"),
        ]
        span_first_n_plus_one_problems = [
            make_problem(N_PLUS_ONE_API_GROUPTYPE, desc="span-first n+1 desc"),
        ]
        span_first_problems_by_grouptype = {
            SLOW_DB_SLUG: span_first_slow_db_problems,
            N_PLUS_ONE_API_SLUG: span_first_n_plus_one_problems,
        }

        control_slow_db_problems = [
            make_problem(SLOW_DB_GROUPTYPE, desc="control db desc"),
        ]
        control_n_plus_one_problems = [
            make_problem(N_PLUS_ONE_API_GROUPTYPE, desc="control n+1 desc"),
        ]
        control_problems = control_slow_db_problems + control_n_plus_one_problems

        with patch(
            "sentry.issue_detection.detectors.span_first.run_detectors._compare_problem_sets"
        ) as mock_compare_problem_sets:
            compare_span_first_problems_to_control_data(
                self.project,
                "1121201212312012",
                span_first_problems_by_grouptype,
                control_problems,
            )

            mock_compare_problem_sets.assert_any_call(
                [problem.to_dict() for problem in control_slow_db_problems],
                [problem.to_dict() for problem in span_first_slow_db_problems],
            )
            mock_compare_problem_sets.assert_any_call(
                [problem.to_dict() for problem in control_n_plus_one_problems],
                [problem.to_dict() for problem in span_first_n_plus_one_problems],
            )

    def test_reports_match_when_problems_are_identical(self) -> None:
        span_first_problems = [make_problem(SLOW_DB_GROUPTYPE)]
        control_problems = [make_problem(SLOW_DB_GROUPTYPE)]

        with (
            patch(
                "sentry.issue_detection.detectors.span_first.run_detectors._log_mismatch"
            ) as mock_log_mismatch,
            patch(
                "sentry.issue_detection.detectors.span_first.run_detectors.metrics.incr"
            ) as mock_metrics_incr,
        ):
            compare_span_first_problems_to_control_data(
                self.project,
                "1121201212312012",
                {SLOW_DB_SLUG: span_first_problems},
                control_problems,
            )

            mock_log_mismatch.assert_not_called()
            mock_metrics_incr.assert_called_with(
                "span_first_detectors.compare_results",
                sample_rate=1.0,
                tags={"callsite": SLOW_DB_SLUG, "exact_match": True},
            )

    def test_reports_mismatch_when_problems_differ(self) -> None:
        span_first_problems = [make_problem(SLOW_DB_GROUPTYPE, desc="span-first desc")]
        control_problems = [make_problem(SLOW_DB_GROUPTYPE, desc="control desc")]

        with (
            patch(
                "sentry.issue_detection.detectors.span_first.run_detectors._log_mismatch"
            ) as mock_log_mismatch,
            patch(
                "sentry.issue_detection.detectors.span_first.run_detectors.metrics.incr"
            ) as mock_metrics_incr,
        ):
            compare_span_first_problems_to_control_data(
                self.project,
                "1121201212312012",
                {SLOW_DB_SLUG: span_first_problems},
                control_problems,
            )

            mock_log_mismatch.assert_called_with(
                problem_type=SLOW_DB_SLUG,
                control_problems=[problem.to_dict() for problem in control_problems],
                span_first_problems=[problem.to_dict() for problem in span_first_problems],
                shared_fingerprints={"slow-db-fingerprint"},
                non_shared_fingerprints=set(),
                diffs={"desc": ["slow-db-fingerprint"]},
                extra_metadata={
                    "trace_id": "1121201212312012",
                    "project_id": self.project.id,
                    "project_slug": self.project.slug,
                    "org_slug": self.organization.slug,
                },
            )
            mock_metrics_incr.assert_any_call(
                "span_first_detectors.compare_results",
                sample_rate=1.0,
                tags={"callsite": SLOW_DB_SLUG, "exact_match": False},
            )

    def test_logs_mismatch_with_diffs(self) -> None:
        span_first_problems = [make_problem(SLOW_DB_GROUPTYPE, desc="span-first desc")]
        control_problems = [make_problem(SLOW_DB_GROUPTYPE, desc="control desc")]

        with (
            patch(
                "sentry.issue_detection.detectors.span_first.run_detectors.logger.info"
            ) as mock_python_logger,
            patch(
                "sentry.issue_detection.detectors.span_first.run_detectors.sdk_logger.info"
            ) as mock_sdk_logger,
        ):
            compare_span_first_problems_to_control_data(
                self.project,
                "1121201212312012",
                {SLOW_DB_SLUG: span_first_problems},
                control_problems,
            )

            mock_sdk_logger.assert_any_call(
                "span_first_detectors.problem_mismatch",
                attributes={
                    "data": {
                        "problem_type": "performance_slow_db_query",
                        "raw_data": {
                            "control": {
                                "fingerprint": "slow-db-fingerprint",
                                "op": "db",
                                "desc": "control desc",
                                "parent_span_ids": [],
                                "cause_span_ids": [],
                                "offender_span_ids": [],
                                "evidence_data": {},
                            },
                            "span_first": {
                                "fingerprint": "slow-db-fingerprint",
                                "op": "db",
                                "desc": "span-first desc",
                                "parent_span_ids": [],
                                "cause_span_ids": [],
                                "offender_span_ids": [],
                                "evidence_data": {},
                            },
                        },
                        "trace_id": "1121201212312012",
                        "project_id": self.project.id,
                        "project_slug": self.project.slug,
                        "org_slug": self.organization.slug,
                        "diff_keys": "desc",
                    },
                },
            )

            # Since problem objects can contain customer data, ensure that we're using the SDK
            # logger (which logs only to Sentry) rather than the Python logger (which logs to both
            # Sentry and GCP).
            mock_python_logger.assert_not_called()

    def test_logs_mismatch_with_non_shared_fingerprints(self) -> None:
        # Both pipelines found a problem, but with different fingerprints, so neither problem has a
        # counterpart in the other set to be compared against
        span_first_problems = [
            make_problem(SLOW_DB_GROUPTYPE, fingerprint="span-first-only-fingerprint")
        ]
        control_problems = [make_problem(SLOW_DB_GROUPTYPE, fingerprint="control-only-fingerprint")]

        with patch(
            "sentry.issue_detection.detectors.span_first.run_detectors.sdk_logger.info"
        ) as mock_sdk_logger:
            compare_span_first_problems_to_control_data(
                self.project,
                "1121201212312012",
                {SLOW_DB_SLUG: span_first_problems},
                control_problems,
            )

            mock_sdk_logger.assert_any_call(
                "span_first_detectors.problem_mismatch",
                attributes={
                    "data": {
                        "problem_type": SLOW_DB_SLUG,
                        "raw_data": {
                            "control": {
                                "fingerprint": "control-only-fingerprint",
                                "op": "db",
                                "desc": "test problem",
                                "parent_span_ids": [],
                                "cause_span_ids": [],
                                "offender_span_ids": [],
                                "evidence_data": {},
                            },
                            "span_first": {
                                "fingerprint": "span-first-only-fingerprint",
                                "op": "db",
                                "desc": "test problem",
                                "parent_span_ids": [],
                                "cause_span_ids": [],
                                "offender_span_ids": [],
                                "evidence_data": {},
                            },
                        },
                        "trace_id": "1121201212312012",
                        "project_id": self.project.id,
                        "project_slug": self.project.slug,
                        "org_slug": self.organization.slug,
                        # There are no shared fingerprints, so there are no per-problem diffs to
                        # report (and thus no `diff_keys`) -- just the fact that the fingerprints
                        # themselves don't overlap
                        "non_shared_fingerprints": (
                            "control-only-fingerprint, span-first-only-fingerprint"
                        ),
                    },
                },
            )

    def test_logs_mismatch_grouping_diffs_by_location(self) -> None:
        # Within a single run, multiple problems can mismatch, and in different ways: here two
        # problems differ in their `op` value while a third differs in its `desc` value
        span_first_problems = [
            make_problem(SLOW_DB_GROUPTYPE, fingerprint="fingerprint1", op="http.client"),
            make_problem(SLOW_DB_GROUPTYPE, fingerprint="fingerprint2", op="http.client"),
            make_problem(SLOW_DB_GROUPTYPE, fingerprint="fingerprint3", desc="span-first desc"),
        ]
        control_problems = [
            make_problem(SLOW_DB_GROUPTYPE, fingerprint="fingerprint1", op="db"),
            make_problem(SLOW_DB_GROUPTYPE, fingerprint="fingerprint2", op="db"),
            make_problem(SLOW_DB_GROUPTYPE, fingerprint="fingerprint3", desc="control desc"),
        ]

        with patch(
            "sentry.issue_detection.detectors.span_first.run_detectors.sdk_logger.info"
        ) as mock_sdk_logger:
            compare_span_first_problems_to_control_data(
                self.project,
                "1121201212312012",
                {SLOW_DB_SLUG: span_first_problems},
                control_problems,
            )

            all_logged_data = mock_sdk_logger.call_args.kwargs["attributes"]["data"]
            logged_control_problems = all_logged_data["raw_data"]["control"]
            logged_span_first_problems = all_logged_data["raw_data"]["span_first"]

            # With more than one problem per side, the raw data is logged as a list of problem dicts
            # rather than a single dict
            assert (
                [problem["fingerprint"] for problem in logged_control_problems]
                == [problem["fingerprint"] for problem in logged_span_first_problems]
                == ["fingerprint1", "fingerprint2", "fingerprint3"]
            )
            # The diffs are grouped by where the mismatch occurred, mapping each spot to the
            # fingerprints of the problems which differ there
            assert all_logged_data["diff_keys"] == "desc, op"
            assert all_logged_data["diffs"] == {
                "op": "fingerprint1, fingerprint2",
                "desc": "fingerprint3",
            }

    def test_skips_comparison_for_null_results(self) -> None:
        span_first_slow_db_problems = [make_problem(SLOW_DB_GROUPTYPE)]
        span_first_n_plus_one_problems: list[PerformanceProblem] = []
        span_first_problems_by_grouptype = {
            SLOW_DB_SLUG: span_first_slow_db_problems,
            N_PLUS_ONE_API_SLUG: span_first_n_plus_one_problems,
        }

        control_slow_db_problems = [make_problem(SLOW_DB_GROUPTYPE)]
        control_n_plus_one_problems: list[PerformanceProblem] = []
        control_problems = control_slow_db_problems + control_n_plus_one_problems

        with (
            patch(
                "sentry.issue_detection.detectors.span_first.run_detectors._compare_problem_sets"
            ) as mock_compare_problem_sets,
            patch(
                "sentry.issue_detection.detectors.span_first.run_detectors.metrics.incr"
            ) as mock_metrics_incr,
        ):
            compare_span_first_problems_to_control_data(
                self.project, "1121201212312012", span_first_problems_by_grouptype, control_problems
            )

            # Comparison was run only for the slow DB detector results, not for the N+1 results,
            # since they were null
            assert mock_compare_problem_sets.call_count == 1
            mock_compare_problem_sets.assert_any_call(
                [problem.to_dict() for problem in control_slow_db_problems],
                [problem.to_dict() for problem in span_first_slow_db_problems],
            )
            # For the N+1 problems (or lack thereof, as the case may be), we instead logged the skip
            mock_metrics_incr.assert_any_call(
                "span_first_detectors.empty_result_comparison_skipped",
                tags={"callsite": N_PLUS_ONE_API_SLUG},
            )


class CompareProblemSetsTest(TestCase):
    def test_recognizes_matching_problem_sets(self) -> None:
        control_problem_dicts = [make_problem_dict(SLOW_DB_GROUPTYPE)]
        span_first_problem_dicts = [make_problem_dict(SLOW_DB_GROUPTYPE)]

        assert _compare_problem_sets(control_problem_dicts, span_first_problem_dicts) == (
            {"slow-db-fingerprint"},  # Shared fingerprints
            set(),  # Non-shared fingerprints
            {},  # Diffs
        )

    def test_reports_non_shared_fingerprints(self) -> None:
        control_problem_dicts = [
            make_problem_dict(SLOW_DB_GROUPTYPE, fingerprint="shared-fingerprint"),
            make_problem_dict(SLOW_DB_GROUPTYPE, fingerprint="control-only-fingerprint"),
        ]
        span_first_problem_dicts = [
            make_problem_dict(SLOW_DB_GROUPTYPE, fingerprint="shared-fingerprint"),
            make_problem_dict(SLOW_DB_GROUPTYPE, fingerprint="span-first-only-fingerprint"),
        ]

        assert _compare_problem_sets(control_problem_dicts, span_first_problem_dicts) == (
            {"shared-fingerprint"},  # Shared fingerprints
            {"control-only-fingerprint", "span-first-only-fingerprint"},  # Non-shared fingerprints
            {},  # Diffs
        )

    def test_reports_per_problem_diffs_for_shared_fingerprints(self) -> None:
        control_problem_dicts = [make_problem_dict(SLOW_DB_GROUPTYPE, desc="control desc")]
        span_first_problem_dicts = [make_problem_dict(SLOW_DB_GROUPTYPE, desc="span-first desc")]

        assert _compare_problem_sets(control_problem_dicts, span_first_problem_dicts) == (
            {SLOW_DB_FINGERPRINT},  # Shared fingerprints
            set(),  # Non-shared fingerprints
            {"desc": [SLOW_DB_FINGERPRINT]},  # Diffs
        )


class CollectSingleProblemDiffsTest(TestCase):
    def test_recognizes_matching_problems(self) -> None:
        control_problem_dict = make_problem_dict(SLOW_DB_GROUPTYPE)
        span_first_problem_dict = make_problem_dict(SLOW_DB_GROUPTYPE)
        diffs: dict[str, list[str]] = defaultdict(list)

        _collect_single_problem_diffs(control_problem_dict, span_first_problem_dict, diffs)

        assert diffs == {}

    def test_detects_op_and_desc_differences(self) -> None:
        control_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE,
            op="control_op",
            desc="control desc",
        )
        span_first_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE,
            op="span_first_op",
            desc="span-first desc",
        )
        diffs: dict[str, list[str]] = defaultdict(list)

        _collect_single_problem_diffs(control_problem_dict, span_first_problem_dict, diffs)

        assert diffs == {"op": [SLOW_DB_FINGERPRINT], "desc": [SLOW_DB_FINGERPRINT]}

    def test_detects_span_id_differences(self) -> None:
        control_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE,
            parent_span_ids=["dogs"],
            cause_span_ids=["are"],
            offender_span_ids=["great"],
        )
        span_first_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE,
            parent_span_ids=["adopt"],
            cause_span_ids=["don't"],
            offender_span_ids=["shop"],
        )
        diffs: dict[str, list[str]] = defaultdict(list)

        _collect_single_problem_diffs(control_problem_dict, span_first_problem_dict, diffs)

        assert diffs == {
            "parent_span_ids": [SLOW_DB_FINGERPRINT],
            "cause_span_ids": [SLOW_DB_FINGERPRINT],
            "offender_span_ids": [SLOW_DB_FINGERPRINT],
        }

    def test_ignores_span_id_order(self) -> None:
        control_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE,
            offender_span_ids=["maisey", "charlie"],
        )
        span_first_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE,
            offender_span_ids=["charlie", "maisey"],
        )
        diffs: dict[str, list[str]] = defaultdict(list)

        _collect_single_problem_diffs(control_problem_dict, span_first_problem_dict, diffs)

        assert diffs == {}

    def test_detects_evidence_display_differences(self) -> None:
        control_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE,
            evidence_display=[IssueEvidence("Offending Span", "dogs are great", True)],
        )
        span_first_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE,
            evidence_display=[IssueEvidence("Offending Span", "adopt don't shop", True)],
        )
        diffs: dict[str, list[str]] = defaultdict(list)

        _collect_single_problem_diffs(control_problem_dict, span_first_problem_dict, diffs)

        assert diffs == {"evidence_display": [SLOW_DB_FINGERPRINT]}

    def test_detects_non_shared_evidence_data_keys(self) -> None:
        control_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE, evidence_data={"dogs": "are great"}
        )
        span_first_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE, evidence_data={"adopt": "don't shop"}
        )
        diffs: dict[str, list[str]] = defaultdict(list)

        _collect_single_problem_diffs(control_problem_dict, span_first_problem_dict, diffs)

        assert diffs == {"evidence_data.non_shared_keys": [f"{SLOW_DB_FINGERPRINT}: adopt, dogs"]}

    def test_detects_different_evidence_data_values(self) -> None:
        control_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE, evidence_data={"repeating_spans_count": 5}
        )
        span_first_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE, evidence_data={"repeating_spans_count": 3}
        )
        diffs: dict[str, list[str]] = defaultdict(list)

        _collect_single_problem_diffs(control_problem_dict, span_first_problem_dict, diffs)

        assert diffs == {"evidence_data.repeating_spans_count": [SLOW_DB_FINGERPRINT]}

    def test_ignores_order_when_comparing_lists_in_evidence_data(self) -> None:
        control_problem_dict = make_problem_dict(
            N_PLUS_ONE_API_GROUPTYPE, evidence_data={"parameters": ["maisey", "charlie"]}
        )
        reordered_params_problem_dict = make_problem_dict(
            N_PLUS_ONE_API_GROUPTYPE, evidence_data={"parameters": ["charlie", "maisey"]}
        )
        different_params_problem_dict = make_problem_dict(
            N_PLUS_ONE_API_GROUPTYPE, evidence_data={"parameters": ["maisey", "piper"]}
        )
        reordering_diffs: dict[str, list[str]] = defaultdict(list)
        different_params_diffs: dict[str, list[str]] = defaultdict(list)

        _collect_single_problem_diffs(
            control_problem_dict, reordered_params_problem_dict, reordering_diffs
        )
        _collect_single_problem_diffs(
            control_problem_dict, different_params_problem_dict, different_params_diffs
        )

        assert reordering_diffs == {}
        assert different_params_diffs == {"evidence_data.parameters": [N_PLUS_ONE_API_FINGERPRINT]}

    def test_detects_span_evidence_key_value_diff(self) -> None:
        control_problem_dict = make_problem_dict(
            CONSECUTIVE_DB_GROUPTYPE,
            evidence_data={
                "span_evidence_key_value": [{"key": "Transaction", "value": "dogs are great"}]
            },
        )
        span_first_problem_dict = make_problem_dict(
            CONSECUTIVE_DB_GROUPTYPE,
            evidence_data={
                "span_evidence_key_value": [{"key": "Transaction", "value": "adopt, don't shop"}]
            },
        )
        diffs: dict[str, list[str]] = defaultdict(list)

        _collect_single_problem_diffs(control_problem_dict, span_first_problem_dict, diffs)

        assert diffs == {"evidence_data.span_evidence_key_value": [CONSECUTIVE_DB_FINGERPRINT]}

    def test_skips_comparing_span_ids_within_evidence_data(self) -> None:
        control_offender_span_ids = ["dogs_are_great"]
        span_first_offender_span_ids = ["adopt_dont_shop"]

        control_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE,
            offender_span_ids=control_offender_span_ids,
            evidence_data={"offender_span_ids": control_offender_span_ids},
        )
        span_first_problem_dict = make_problem_dict(
            SLOW_DB_GROUPTYPE,
            offender_span_ids=span_first_offender_span_ids,
            evidence_data={"offender_span_ids": span_first_offender_span_ids},
        )
        diffs: dict[str, list[str]] = defaultdict(list)

        with patch(
            "sentry.issue_detection.detectors.span_first.run_detectors._are_equivalent_lists",
            wraps=_are_equivalent_lists,
        ) as are_equivalent_lists_spy:
            _collect_single_problem_diffs(control_problem_dict, span_first_problem_dict, diffs)

            # Even though the offender span ids appear in two spots in the problem, we only compare
            # them once (the same applies to parent span ids and cause span ids)
            assert (
                count_matching_calls(
                    are_equivalent_lists_spy,
                    control_offender_span_ids,
                    span_first_offender_span_ids,
                )
                == 1
            )
