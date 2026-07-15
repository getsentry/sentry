from __future__ import annotations

from typing import Any, Literal
from unittest.mock import ANY, patch

import pytest

from sentry.issue_detection.base import DetectorType
from sentry.issue_detection.detectors.span_first.base import SpanFirstDetector
from sentry.issue_detection.detectors.span_first.run_detectors import (
    _compare_fingerprint_sets,
    compare_span_first_problems_to_control_data,
    run_detector,
    run_span_first_detectors,
)
from sentry.issue_detection.detectors.span_first.span_first_utils import (
    SpanFirstDetectorsRolloutController,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issue_detection.types import StandaloneSpan
from sentry.issues.grouptype import (
    GroupType,
    PerformanceNPlusOneGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.issue_detection.segment_span_generators import (
    create_child_span,
    create_segment,
)

SLOW_DB_GROUPTYPE = PerformanceSlowDBQueryGroupType
N_PLUS_ONE_GROUPTYPE = PerformanceNPlusOneGroupType
SLOW_DB_SLUG = SLOW_DB_GROUPTYPE.slug
N_PLUS_ONE_SLUG = N_PLUS_ONE_GROUPTYPE.slug


def make_problem(fingerprint: str, grouptype: type[GroupType]) -> PerformanceProblem:
    return PerformanceProblem(
        fingerprint=fingerprint,
        op="db",
        desc="test problem",
        type=grouptype,
        parent_span_ids=[],
        cause_span_ids=[],
        offender_span_ids=[],
        evidence_data={},
        evidence_display=[],
    )


class MockSlowDBDetector(SpanFirstDetector):
    type = DetectorType.SLOW_DB_QUERY
    grouptype = SLOW_DB_GROUPTYPE

    def visit_span(self, span: StandaloneSpan) -> None:
        # No-op: this stub emits its problem in `on_complete`.
        pass

    def on_complete(self) -> None:
        problem = make_problem("slow-db-fingerprint", SLOW_DB_GROUPTYPE)
        self.stored_problems[problem.fingerprint] = problem


class MockNPlusOneDetector(SpanFirstDetector):
    type = DetectorType.N_PLUS_ONE_DB_QUERIES
    grouptype = N_PLUS_ONE_GROUPTYPE

    def visit_span(self, span: StandaloneSpan) -> None:
        # No-op: this stub emits its problem in `on_complete`.
        pass

    def on_complete(self) -> None:
        problem = make_problem("n-plus-one-fingerprint", N_PLUS_ONE_GROUPTYPE)
        self.stored_problems[problem.fingerprint] = problem


@pytest.mark.django_db
class RunDetectorTest(TestCase):
    def test_returns_problems_emitted_by_the_detector(self) -> None:
        segment = create_segment([create_child_span(op="db", duration=1001)])

        result = run_detector(MockSlowDBDetector, {"detection_enabled": True}, segment[0], segment)

        assert len(result) == 1
        assert result[0].fingerprint == "slow-db-fingerprint"

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
            N_PLUS_ONE_SLUG: [MockNPlusOneDetector],
        }
        with patch.dict(
            "sentry.issue_detection.detectors.span_first.run_detectors.SPAN_FIRST_DETECTORS_BY_GROUPTYPE",
            mock_registry,
            clear=True,
        ):
            span_first_problems_by_grouptype = run_span_first_detectors(
                [SLOW_DB_SLUG, N_PLUS_ONE_SLUG],
                dummy_segment[0],
                dummy_segment,
                self.project,
            )

        assert set(span_first_problems_by_grouptype.keys()) == {SLOW_DB_SLUG, N_PLUS_ONE_SLUG}

        slow_db_problems = span_first_problems_by_grouptype[SLOW_DB_SLUG]
        n_plus_one_problems = span_first_problems_by_grouptype[N_PLUS_ONE_SLUG]
        assert [p.fingerprint for p in slow_db_problems] == ["slow-db-fingerprint"]
        assert [p.fingerprint for p in n_plus_one_problems] == ["n-plus-one-fingerprint"]


class CompareSpanFirstProblemsToControlDataTest(TestCase):
    def _get_shared_compare_kwargs(self) -> dict[str, Any]:
        return {
            "is_experimental_data_nullish": False,
            "source_of_truth": "neither",
            "exact_match_comparator": _compare_fingerprint_sets,
            "debug_context": {
                "org_slug": self.project.organization.slug,
                "project_id": self.project.id,
                "project_slug": self.project.slug,
            },
            # lambdas won't compare equal; we'll verify the serializer separately by seeing what
            # gets logged
            "data_serializer": ANY,
            "metric_sample_rate": 1.0,
        }

    def _get_dummy_problem_data(self, kind: Literal["slow_db", "n_plus_one"]) -> dict[str, Any]:
        dummy_problem_data = {
            "cause_span_ids": [],
            "evidence_data": {},
            "evidence_display": [],
            "offender_span_ids": [],
            "op": "db",
            "parent_span_ids": [],
            "desc": "test problem",
        }
        return {**dummy_problem_data, "type": 1001 if kind == "slow_db" else 1006}

    def _get_shared_logger_extras(self) -> dict[str, Any]:
        return {
            "rollout_name": "span_first_detectors",
            "source_of_truth": "neither",
            "exact_match": False,
            "reasonable_match": None,
            "is_null_result": False,
            "debug_context": {
                "org_slug": self.organization.slug,
                "project_id": self.project.id,
                "project_slug": self.project.slug,
            },
        }

    def test_compares_fingerprints_for_each_grouptype(self) -> None:
        span_first_slow_db_problems = [
            make_problem("slow-db-fingerprint", SLOW_DB_GROUPTYPE),
            make_problem("span-first-slow-db-fingerprint", SLOW_DB_GROUPTYPE),
        ]
        span_first_n_plus_one_problems = [
            make_problem("n-plus-one-fingerprint", N_PLUS_ONE_GROUPTYPE),
            make_problem("span-first-n-plus-one-fingerprint", N_PLUS_ONE_GROUPTYPE),
        ]
        span_first_problems_by_grouptype = {
            SLOW_DB_SLUG: span_first_slow_db_problems,
            N_PLUS_ONE_SLUG: span_first_n_plus_one_problems,
        }

        control_slow_db_problems = [
            # One problem which matches the span-first set, one which doesn't
            make_problem("slow-db-fingerprint", SLOW_DB_GROUPTYPE),
            make_problem("control-slow-db-fingerprint", SLOW_DB_GROUPTYPE),
        ]
        control_n_plus_one_problems = [
            # One problem which matches the span-first set, one which doesn't
            make_problem("n-plus-one-fingerprint", N_PLUS_ONE_GROUPTYPE),
            make_problem("control-n-plus-one-fingerprint", N_PLUS_ONE_GROUPTYPE),
        ]
        control_problems = control_slow_db_problems + control_n_plus_one_problems

        # First mock `compare`, to verify we're comparing the right things
        with patch.object(SpanFirstDetectorsRolloutController, "compare") as mock_compare:
            compare_span_first_problems_to_control_data(
                self.project,
                span_first_problems_by_grouptype,
                control_problems,
                get_source_of_truth=lambda _: "neither",
            )

            mock_compare.assert_any_call(
                callsite=SLOW_DB_SLUG,
                control_data=control_slow_db_problems,
                experimental_data=span_first_slow_db_problems,
                **self._get_shared_compare_kwargs(),
            )
            mock_compare.assert_any_call(
                callsite=N_PLUS_ONE_SLUG,
                control_data=control_n_plus_one_problems,
                experimental_data=span_first_n_plus_one_problems,
                **self._get_shared_compare_kwargs(),
            )

        # Now mock the things `compare` either directly or indirectly calls, to show that we are in
        # fact checking the fingerprints, and that we're logging mismatches correctly
        with (
            patch(
                "sentry.issue_detection.detectors.span_first.run_detectors._compare_fingerprint_sets",
                wraps=_compare_fingerprint_sets,
            ) as mock_compare_fingerprints,
            patch.object(
                SpanFirstDetectorsRolloutController, "_should_log_mismatch", lambda _: True
            ),
            patch("sentry.utils.rollout.logger.info") as mock_python_logger,
            patch("sentry.utils.rollout.sdk_logger.info") as mock_sdk_logger,
        ):
            compare_span_first_problems_to_control_data(
                self.project,
                span_first_problems_by_grouptype,
                control_problems,
                get_source_of_truth=lambda _: "neither",
            )

            mock_compare_fingerprints.assert_any_call(
                control_slow_db_problems, span_first_slow_db_problems
            )
            mock_compare_fingerprints.assert_any_call(
                control_n_plus_one_problems, span_first_n_plus_one_problems
            )

            shared_logger_extras = self._get_shared_logger_extras()
            dummy_slow_db_data = self._get_dummy_problem_data("slow_db")
            dummy_n_plus_one_data = self._get_dummy_problem_data("n_plus_one")

            mock_sdk_logger.assert_any_call(
                "saferollout.mismatch",
                attributes={
                    "callsite": SLOW_DB_SLUG,
                    "control_data_raw": [
                        {**dummy_slow_db_data, "fingerprint": "slow-db-fingerprint"},
                        {**dummy_slow_db_data, "fingerprint": "control-slow-db-fingerprint"},
                    ],
                    "experimental_data_raw": [
                        {**dummy_slow_db_data, "fingerprint": "slow-db-fingerprint"},
                        {**dummy_slow_db_data, "fingerprint": "span-first-slow-db-fingerprint"},
                    ],
                    **shared_logger_extras,
                },
            )
            mock_sdk_logger.assert_any_call(
                "saferollout.mismatch",
                attributes={
                    "callsite": N_PLUS_ONE_SLUG,
                    "control_data_raw": [
                        {**dummy_n_plus_one_data, "fingerprint": "n-plus-one-fingerprint"},
                        {**dummy_n_plus_one_data, "fingerprint": "control-n-plus-one-fingerprint"},
                    ],
                    "experimental_data_raw": [
                        {**dummy_n_plus_one_data, "fingerprint": "n-plus-one-fingerprint"},
                        {
                            **dummy_n_plus_one_data,
                            "fingerprint": "span-first-n-plus-one-fingerprint",
                        },
                    ],
                    **shared_logger_extras,
                },
            )

            # Since problem objects can contain customer data, ensure that we're using the SDK
            # logger (which logs only to Sentry, and which we've shown above that we use) rather
            # than the Python logger (which logs to both Sentry and GCP).
            mock_python_logger.assert_not_called()

    def test_skips_comparison_for_null_results(self) -> None:
        span_first_slow_db_problems = [make_problem("slow-db-fingerprint", SLOW_DB_GROUPTYPE)]
        span_first_n_plus_one_problems: list[PerformanceProblem] = []
        span_first_problems_by_grouptype = {
            SLOW_DB_SLUG: span_first_slow_db_problems,
            N_PLUS_ONE_SLUG: span_first_n_plus_one_problems,
        }

        control_slow_db_problems = [make_problem("slow-db-fingerprint", SLOW_DB_GROUPTYPE)]
        control_n_plus_one_problems: list[PerformanceProblem] = []
        control_problems = control_slow_db_problems + control_n_plus_one_problems

        with patch.object(SpanFirstDetectorsRolloutController, "compare") as mock_compare:
            compare_span_first_problems_to_control_data(
                self.project,
                span_first_problems_by_grouptype,
                control_problems,
                get_source_of_truth=lambda _: "neither",
            )

            # Comparison was run only for the slow DB detector results, not for the n+1 results,
            # since they were null
            assert mock_compare.call_count == 1
            mock_compare.assert_any_call(
                callsite=SLOW_DB_SLUG,
                control_data=control_slow_db_problems,
                experimental_data=span_first_slow_db_problems,
                **self._get_shared_compare_kwargs(),
            )
