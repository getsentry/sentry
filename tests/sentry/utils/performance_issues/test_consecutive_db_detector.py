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
        event = create_event(spans)

        problems = self.find_problems(event)

        assert problems == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES-e6a9fc04320a924f46c7c737432bb0389d9dd095",
                op="db",
                desc="SELECT `order`.`id` FROM `books_author`",
                type=GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
                parent_span_ids=None,
                cause_span_ids=["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb"],
                offender_span_ids=["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb"],
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
        event = create_event(spans)

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
        event = create_event(spans)

        problems = self.find_problems(event)

        assert problems == []

    def test_does_not_detect_consecutive_db_spans_with_fast_spans(self):
        span_duration = 1
        spans = [
            create_span("db", span_duration, "SELECT `customer`.`id` FROM `customers`"),
            create_span("db", span_duration, "SELECT `order`.`id` FROM `books_author`"),
            create_span("db", span_duration, "SELECT `product`.`id` FROM `products`"),
        ]
        spans = [modify_span_start(span, span_duration * spans.index(span)) for span in spans]
        event = create_event(spans)

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
        event = create_event(spans)

        problems = self.find_problems(event)

        assert problems == []

    def test_detects_consecutive_db_in_query_waterfall_event(self):
        event = get_event("query-waterfall-in-django-random-view")

        problems = self.find_problems(event)

        assert problems == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES-0700523cc3ca755e447329779e50aeb19549e74f",
                op="db",
                desc="SELECT `books_book`.`id`, `books_book`.`title`, `books_book`.`author_id` FROM `books_book` ORDER BY `books_book`.`id` ASC LIMIT 1",
                type=GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
                parent_span_ids=None,
                cause_span_ids=["abca1c35669c11f2", "a6e7c330f656df7f", "857ee9ba7db8cd31"],
                offender_span_ids=["857ee9ba7db8cd31"],
            )
        ]

    def test_does_not_detect_consecutive_db_with_low_time_saving(self):
        span_duration = 10
        spans = [
            create_span(
                "db",
                span_duration,
                "SELECT `customer`.`id` FROM `customers` WHERE `customer`.`name` = $1",
            ),
            create_span(
                "db",
                span_duration,
                "SELECT `order`.`id` FROM `books_author` WHERE `author`.`type` = $1",
            ),
            create_span("db", 900, "SELECT COUNT(*) FROM `products`"),
        ]
        spans = [
            modify_span_start(span, span_duration * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap

        event = create_event(spans)

        assert self.find_problems(event) == []

    def test_detects_consecutive_db_with_high_time_saving(self):
        span_duration = 50
        spans = [
            create_span(
                "db",
                span_duration,
                "SELECT `customer`.`id` FROM `customers` WHERE `customer`.`name` = $1",
            ),
            create_span(
                "db",
                span_duration,
                "SELECT `order`.`id` FROM `books_author` WHERE `author`.`type` = $1",
            ),
            create_span("db", 900, "SELECT COUNT(*) FROM `products`"),
        ]
        spans = [
            modify_span_start(span, span_duration * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap

        event = create_event(spans)

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES-e6a9fc04320a924f46c7c737432bb0389d9dd095",
                op="db",
                desc="SELECT COUNT(*) FROM `products`",
                type=GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
                parent_span_ids=None,
                cause_span_ids=["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb"],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
            )
        ]
