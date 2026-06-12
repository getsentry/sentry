from __future__ import annotations

from collections.abc import Sequence

import pytest

from sentry.issue_detection.detectors.span_first import run_detector
from sentry.issue_detection.detectors.span_first.slow_db_query_detector import (
    SpanFirstSlowDBQueryDetector,
)
from sentry.issue_detection.detectors.span_first.span_first_utils import get_settings_for_detector
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issue_detection.types import StandaloneSpan
from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.testutils.cases import TestCase
from sentry.testutils.issue_detection.segment_span_generators import (
    DEFAULT_CHILD_SPAN_ID,
    create_child_span,
    create_segment,
    load_fixture,
)


@pytest.mark.django_db
class SpanFirstSlowDBQueryDetectorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self._settings = get_settings_for_detector(SpanFirstSlowDBQueryDetector.type)

    def find_problems(self, segment: Sequence[StandaloneSpan]) -> list[PerformanceProblem]:
        segment_span = segment[0]
        return run_detector(SpanFirstSlowDBQueryDetector, self._settings, segment_span, segment)

    def test_detects_slow_spans(self) -> None:
        assert self._settings["duration_threshold"] == 1000
        fast_segment = create_segment([create_child_span(op="db", duration=999)])
        slow_segment = create_segment([create_child_span(op="db", duration=1001)])

        assert self.find_problems(fast_segment) == []
        assert self.find_problems(slow_segment) == [
            PerformanceProblem(
                fingerprint="1-1001-da39a3ee5e6b4b0d3255bfef95601890afd80709",
                op="db",
                desc="SELECT count() FROM table WHERE id = %s",
                type=PerformanceSlowDBQueryGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=[DEFAULT_CHILD_SPAN_ID],
                evidence_data={
                    "op": "db",
                    "cause_span_ids": [],
                    "parent_span_ids": [],
                    "offender_span_ids": [DEFAULT_CHILD_SPAN_ID],
                    "transaction_name": "default-transaction",
                    "repeating_spans": "db - SELECT count() FROM table WHERE id = %s",
                    "repeating_spans_compact": "SELECT count() FROM table WHERE id = %s",
                    "num_repeating_spans": "1",
                },
                evidence_display=[
                    IssueEvidence(
                        name="Offending Spans",
                        value="db - SELECT count() FROM table WHERE id = %s",
                        important=True,
                    )
                ],
            )
        ]

    def test_ignores_ineligible_spans(self) -> None:
        wrong_op_segment = create_segment(
            [create_child_span(op="dogs", duration=1001, description="SELECT some stuff")]
        )
        wrong_desc_segment = create_segment(
            [create_child_span(op="db", duration=1001, description="FETCH the ball")]
        )
        truncated_desc_segment = create_segment(
            [
                create_child_span(
                    op="db", duration=1001, description="SELECT `product`.`id` FROM `products` ..."
                )
            ]
        )

        assert self.find_problems(wrong_op_segment) == []
        assert self.find_problems(wrong_desc_segment) == []
        assert self.find_problems(truncated_desc_segment) == []

    def test_respects_enablement_flag(self) -> None:
        segment = create_segment(
            [
                create_child_span(
                    op="db", duration=1005, description="SELECT `product`.`id` FROM `products`"
                )
            ]
        )
        segment_span = segment[0]

        detector = SpanFirstSlowDBQueryDetector(self._settings, segment_span, segment)
        assert detector.is_creation_allowed()

        disabled_settings = {**self._settings, "detection_enabled": False}
        detector = SpanFirstSlowDBQueryDetector(disabled_settings, segment_span, segment)
        assert not detector.is_creation_allowed()

    def test_detects_slow_span_in_solved_n_plus_one_query(self) -> None:
        segment = load_fixture("slow-db-solved-n-plus-one")
        expected_description = (
            "SELECT VERSION(),\n"
            + "@@sql_mode,\n"
            + "@@default_storage_engine,\n"
            + "@@sql_auto_is_null,\n"
            + "@@lower_case_table_names,\n"
            + "CONVERT_TZ('2001-01-01 01:00:00', 'UTC', 'UTC') IS NOT NULL"
        )

        assert self.find_problems(segment) == [
            PerformanceProblem(
                fingerprint="1-1001-d02c8b2fd92a2d72011671feda429fa8ce2ac00f",
                op="db",
                desc=expected_description,
                type=PerformanceSlowDBQueryGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["a05754d3fde2db29"],
                evidence_data={
                    "op": "db",
                    "cause_span_ids": [],
                    "parent_span_ids": [],
                    "offender_span_ids": ["a05754d3fde2db29"],
                    "transaction_name": "/books/",
                    "repeating_spans": f"db - {expected_description}",
                    "repeating_spans_compact": expected_description,
                    "num_repeating_spans": "1",
                },
                evidence_display=[
                    IssueEvidence(
                        name="Offending Spans",
                        value=f"db - {expected_description}",
                        important=True,
                    )
                ],
            )
        ]
