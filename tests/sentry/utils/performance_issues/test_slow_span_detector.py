import unittest
from typing import List

import pytest

from sentry.eventstore.models import Event
from sentry.testutils.performance_issues.event_generators import (
    create_event,
    create_span,
    get_event,
)
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.performance_detection import (
    GroupType,
    PerformanceProblem,
    SlowSpanDetector,
    get_detection_settings,
    run_detector_on_data,
)


@region_silo_test
@pytest.mark.django_db
class SlowSpanDetectorTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def find_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = SlowSpanDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_calls_detect_slow_span(self):
        no_slow_span_event = create_event([create_span("db", 999.0)] * 1)
        slow_not_allowed_op_span_event = create_event([create_span("random", 1001.0, "example")])
        slow_span_event = create_event([create_span("db", 1001.0)] * 1)

        assert self.find_problems(no_slow_span_event) == []
        assert self.find_problems(slow_not_allowed_op_span_event) == []
        assert self.find_problems(slow_span_event) == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_SLOW_SPAN-020e34d374ab4b5cd00a6a1b4f76f325209f7263",
                op="db",
                desc="SELECT count() FROM table WHERE id = %s",
                type=GroupType.PERFORMANCE_SLOW_SPAN,
                parent_span_ids=None,
                cause_span_ids=None,
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
            )
        ]

    def test_skip_queries_without_select(self):
        event = create_event([create_span("db", 100000.0, "DELETE FROM table WHERE id = %s")] * 1)
        assert self.find_problems(event) == []

    def test_calls_slow_span_threshold(self):
        http_span_event = create_event(
            [create_span("http.client", 1001.0, "http://example.com")] * 1
        )
        db_span_event = create_event([create_span("db.query", 1001.0)] * 1)

        assert self.find_problems(http_span_event) == []
        assert self.find_problems(db_span_event) == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_SLOW_SPAN-dff8b4c2cafa12af9b5a35f3b12f9f8c2d790170",
                op="db.query",
                desc="SELECT count() FROM table WHERE id = %s",
                type=GroupType.PERFORMANCE_SLOW_SPAN,
                parent_span_ids=None,
                cause_span_ids=None,
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
            )
        ]

    def test_detects_slow_span_in_solved_n_plus_one_query(self):
        n_plus_one_event = get_event("solved-n-plus-one-in-django-index-view")

        assert self.find_problems(n_plus_one_event) == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_SLOW_SPAN-8dbbcc64ef67d2d9d390327411669ebe29b0ea45",
                op="db",
                desc="\n                SELECT VERSION(),\n                       @@sql_mode,\n                       @@default_storage_engine,\n                       @@sql_auto_is_null,\n                       @@lower_case_table_names,\n                       CONVERT_TZ('2001-01-01 01:00:00', 'UTC', 'UTC') IS NOT NULL\n            ",
                type=GroupType.PERFORMANCE_SLOW_SPAN,
                parent_span_ids=None,
                cause_span_ids=None,
                offender_span_ids=["a05754d3fde2db29"],
            )
        ]

    def test_skips_truncated_queries(self):
        slow_span_event_with_truncated_query = create_event(
            [create_span("db", 1005, "SELECT `product`.`id` FROM `products` ...")] * 1
        )
        slow_span_event = create_event(
            [create_span("db", 1005, "SELECT `product`.`id` FROM `products`")] * 1
        )

        assert self.find_problems(slow_span_event_with_truncated_query) == []
        assert self.find_problems(slow_span_event) == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_SLOW_SPAN-020e34d374ab4b5cd00a6a1b4f76f325209f7263",
                op="db",
                desc="SELECT `product`.`id` FROM `products`",
                type=GroupType.PERFORMANCE_SLOW_SPAN,
                parent_span_ids=None,
                cause_span_ids=None,
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
            )
        ]
