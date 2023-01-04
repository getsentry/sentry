import unittest
from typing import List

import pytest

from sentry.eventstore.models import Event
from sentry.testutils.performance_issues.event_generators import (
    create_event,
    create_span,
    get_event,
    modify_span_start,
)
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.performance_detection import (
    ConsecutiveDBSpanDetector,
    GroupType,
    PerformanceProblem,
    get_detection_settings,
    run_detector_on_data,
)

SECOND = 1000


@region_silo_test
@pytest.mark.django_db
class ConsecutiveDbDetectorTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def find_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = ConsecutiveDBSpanDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_consecutive_db_spans(self):
        span_duration = 1 * SECOND
        spans = [
            create_span("db", span_duration, "SELECT `customer`.`id` FROM `customers`"),
            create_span("db", span_duration, "SELECT `order`.`id` FROM `books_author`"),
            create_span("db", span_duration, "SELECT `product`.`id` FROM `products`"),
        ]
        spans = [modify_span_start(span, span_duration * spans.index(span)) for span in spans]
        event = create_event(spans, "a" * 16)

        problems = self.find_problems(event)

        assert problems == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_CONSECUTIVE_DB_OP-e6a9fc04320a924f46c7c737432bb0389d9dd095",
                op="db",
                desc="consecutive db",
                type=GroupType.PERFORMANCE_CONSECUTIVE_DB_OP,
                parent_span_ids=None,
                cause_span_ids=None,
                offender_span_ids=["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb"],
            )
        ]

    def test_does_not_detect_consecutive_db_spans_with_truncated_query(self):
        span_duration = 10
        spans = [
            create_span("db", span_duration, "SELECT `customer`.`id` FROM `customers`"),
            create_span(
                "db",
                span_duration,
                "SELECT `order`.`id` FROM `books_author` WHERE `order`.`name` = %s",
            ),
            create_span("db", span_duration, "SELECT `product`.`id` FROM `products` ..."),
        ]
        spans = [modify_span_start(span, span_duration * spans.index(span)) for span in spans]
        event = create_event(spans, "a" * 16)

        problems = self.find_problems(event)

        assert problems == []

    def test_does_not_detect_consecutive_db_spans_with_where(self):
        span_duration = 5
        spans = [
            create_span("db", span_duration, "SELECT `customer`.`id` FROM `customers`"),
            create_span(
                "db",
                span_duration,
                "SELECT `order`.`id` FROM `books_author` WHERE `books_author`.`id` = %s",
            ),
            create_span(
                "db",
                span_duration,
                "SELECT `product`.`id` FROM `products` WHERE `product`.`name` = %s",
            ),
        ]
        spans = [modify_span_start(span, span_duration * spans.index(span)) for span in spans]
        event = create_event(spans, "a" * 16)

        detector = ConsecutiveDBSpanDetector(self.settings, event)
        run_detector_on_data(detector, event)
        problems = list(detector.stored_problems.values())

        assert problems == []

    def test_does_not_detect_consecutive_db_spans_with_fast_spans(self):
        span_duration = 1
        spans = [
            create_span("db", span_duration, "SELECT `customer`.`id` FROM `customers`"),
            create_span("db", span_duration, "SELECT `order`.`id` FROM `books_author`"),
            create_span("db", span_duration, "SELECT `product`.`id` FROM `products`"),
        ]
        spans = [modify_span_start(span, span_duration * spans.index(span)) for span in spans]
        event = create_event(spans, "a" * 16)

        problems = self.find_problems(event)

        assert problems == []

    def test_does_not_detect_consecutive_db_spans_with_parameterized_query(self):
        span_duration = 750
        spans = [
            create_span(
                "db",
                span_duration,
                "SELECT m.* FROM authors a INNER JOIN books b ON a.book_id = b.id AND b.another_id = 'another_id_123' ORDER BY b.created_at DESC LIMIT 3",
            ),
            create_span(
                "db",
                span_duration,
                "SELECT m.* FROM authors a INNER JOIN books b ON a.book_id = b.id AND b.another_id = 'another_id_456' ORDER BY b.created_at DESC LIMIT 3",
            ),
            create_span(
                "db",
                span_duration,
                "SELECT m.* FROM authors a INNER JOIN books b ON a.book_id = b.id AND b.another_id = 'another_id_789' ORDER BY b.created_at DESC LIMIT 3",
            ),
        ]
        spans = [modify_span_start(span, span_duration * spans.index(span)) for span in spans]
        event = create_event(spans, "a" * 16)

        problems = self.find_problems(event)

        assert problems == []

    def test_detects_consecutive_db_in_query_waterfall_event(self):
        event = get_event("query-waterfall-in-django-random-view")

        problems = self.find_problems(event)

        assert problems == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_CONSECUTIVE_DB_OP-0700523cc3ca755e447329779e50aeb19549e74f",
                op="db",
                desc="consecutive db",
                type=GroupType.PERFORMANCE_CONSECUTIVE_DB_OP,
                parent_span_ids=None,
                cause_span_ids=None,
                offender_span_ids=["abca1c35669c11f2", "a6e7c330f656df7f", "857ee9ba7db8cd31"],
            )
        ]
