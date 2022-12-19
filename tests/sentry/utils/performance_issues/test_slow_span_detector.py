import unittest
from typing import List

import pytest

from sentry.eventstore.models import Event
from sentry.testutils.performance_issues.event_generators import create_event, create_span
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.performance_detection import (
    PerformanceProblem,
    PerformanceSpanProblem,
    SlowSpanDetector,
    get_detection_settings,
    run_detector_on_data,
)


@region_silo_test
@pytest.mark.django_db
class ConsecutiveDbDetectorTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def find_slow_span_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = SlowSpanDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_calls_detect_slow_span(self):
        no_slow_span_event = create_event([create_span("db", 999.0)] * 1)
        slow_not_allowed_op_span_event = create_event([create_span("random", 1001.0, "example")])
        slow_span_event = create_event([create_span("db", 1001.0)] * 1)

        assert self.find_slow_span_problems(no_slow_span_event) == []
        assert self.find_slow_span_problems(slow_not_allowed_op_span_event) == []
        assert self.find_slow_span_problems(slow_span_event) == [
            PerformanceSpanProblem(
                allowed_op="db",
                fingerprint="",
                span_id="bbbbbbbbbbbbbbbb",
                spans_involved=["bbbbbbbbbbbbbbbb"],
            )
        ]

    # def test_calls_slow_span_threshold(self):
    #     http_span_event = create_event(
    #         [create_span("http.client", 1001.0, "http://example.com")] * 1
    #     )
    #     db_span_event = create_event([create_span("db.query", 1001.0)] * 1)

    #     assert self.find_slow_span_problems(http_span_event) == []
    #     assert self.find_slow_span_problems(db_span_event) == []
