from __future__ import annotations

from unittest.mock import patch

import pytest

from sentry.issue_detection.base import DetectorType
from sentry.issue_detection.detectors.span_first.base import SpanFirstDetector
from sentry.issue_detection.detectors.span_first.run_detectors import (
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
    def test_compares_fingerprints_for_each_grouptype(self) -> None:
        span_first_problems_by_grouptype = {
            SLOW_DB_SLUG: [
                make_problem("slow-db-fingerprint", SLOW_DB_GROUPTYPE),
                make_problem("span-first-slow-db-fingerprint", SLOW_DB_GROUPTYPE),
            ],
            N_PLUS_ONE_SLUG: [
                make_problem("n-plus-one-fingerprint", N_PLUS_ONE_GROUPTYPE),
                make_problem("span-first-n-plus-one-fingerprint", N_PLUS_ONE_GROUPTYPE),
            ],
        }
        control_problems = [
            # One slow DB problem which matches the span-first set, one which doesn't
            make_problem("slow-db-fingerprint", SLOW_DB_GROUPTYPE),
            make_problem("control-slow-db-fingerprint", SLOW_DB_GROUPTYPE),
            # One N+1 problem which matches the span-first set, one which doesn't
            make_problem("n-plus-one-fingerprint", N_PLUS_ONE_GROUPTYPE),
            make_problem("control-n-plus-one-fingerprint", N_PLUS_ONE_GROUPTYPE),
        ]

        with patch.object(SpanFirstDetectorsRolloutController, "compare") as mock_compare:
            compare_span_first_problems_to_control_data(
                span_first_problems_by_grouptype,
                control_problems,
                get_source_of_truth=lambda _: "neither",
            )

            mock_compare.assert_any_call(
                callsite=SLOW_DB_SLUG,
                control_data={"slow-db-fingerprint", "control-slow-db-fingerprint"},
                experimental_data={"slow-db-fingerprint", "span-first-slow-db-fingerprint"},
                is_experimental_data_nullish=False,
                source_of_truth="neither",
                metric_sample_rate=1.0,
            )
            mock_compare.assert_any_call(
                callsite=N_PLUS_ONE_SLUG,
                control_data={"n-plus-one-fingerprint", "control-n-plus-one-fingerprint"},
                experimental_data={"n-plus-one-fingerprint", "span-first-n-plus-one-fingerprint"},
                is_experimental_data_nullish=False,
                source_of_truth="neither",
                metric_sample_rate=1.0,
            )

    def test_skips_comparison_for_null_results(self) -> None:
        span_first_problems_by_grouptype = {
            SLOW_DB_SLUG: [make_problem("slow-db-fingerprint", SLOW_DB_GROUPTYPE)],
            N_PLUS_ONE_SLUG: [],
        }
        control_problems = [make_problem("slow-db-fingerprint", SLOW_DB_GROUPTYPE)]

        with patch.object(SpanFirstDetectorsRolloutController, "compare") as mock_compare:
            compare_span_first_problems_to_control_data(
                span_first_problems_by_grouptype,
                control_problems,
                get_source_of_truth=lambda _: "neither",
            )

            # Comparison was run only for the slow DB detector results, not for the n+1 results,
            # since they were null
            assert mock_compare.call_count == 1
            mock_compare.assert_any_call(
                callsite=SLOW_DB_SLUG,
                control_data={"slow-db-fingerprint"},
                experimental_data={"slow-db-fingerprint"},
                is_experimental_data_nullish=False,
                source_of_truth="neither",
                metric_sample_rate=1.0,
            )
