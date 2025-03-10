from __future__ import annotations

from typing import Any

import pytest

from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import (
    create_event,
    create_span,
    get_event,
    modify_span_start,
)
from sentry.utils.performance_issues.detectors.consecutive_db_detector import (
    ConsecutiveDBSpanDetector,
)
from sentry.utils.performance_issues.grouptype import PerformanceConsecutiveDBQueriesGroupType
from sentry.utils.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem

SECOND = 1000


@pytest.mark.django_db
class ConsecutiveDbDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = ConsecutiveDBSpanDetector(self._settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def create_issue_event(self, span_duration=50):
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

        return create_event(spans)

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
                fingerprint="1-1007-e6a9fc04320a924f46c7c737432bb0389d9dd095",
                op="db",
                desc="SELECT `order`.`id` FROM `books_author`",
                type=PerformanceConsecutiveDBQueriesGroupType,
                parent_span_ids=None,
                cause_span_ids=["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb"],
                offender_span_ids=["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": None,
                    "cause_span_ids": ["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb"],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
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

    def test_does_not_detect_consecutive_db_in_query_waterfall_event(self):
        event = get_event("query-waterfall-in-django-random-view")

        problems = self.find_problems(event)

        assert problems == []

    def test_does_not_detect_consecutive_db_with_low_time_saving(self):
        event = self.create_issue_event(10)

        assert self.find_problems(event) == []

    def test_detects_consecutive_db_with_high_time_saving(self):
        event = self.create_issue_event()

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1007-3bc15c8aae3e4124dd409035f32ea2fd6835efc9",
                op="db",
                desc="SELECT COUNT(*) FROM `products`",
                type=PerformanceConsecutiveDBQueriesGroupType,
                parent_span_ids=None,
                cause_span_ids=["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb"],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": None,
                    "cause_span_ids": ["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb"],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
            )
        ]

    def test_fingerprint_of_autogroups_match(self):
        span_duration = 50
        spans_1 = [
            create_span(
                "db",
                span_duration,
                "SELECT `customer`.`id` FROM `customers` WHERE `customer`.`name` = $1",
            ),
            create_span("db", 20, "SELECT `customer`.`id` FROM `customers`..."),
            create_span("db", 20, "SELECT `customer`.`id` FROM `customers`..."),
            create_span("db", 20, "SELECT `customer`.`id` FROM `customers`..."),
            create_span("db", 900, "SELECT COUNT(*) FROM `products`"),
        ]
        spans_1 = [
            modify_span_start(span, span_duration * spans_1.index(span)) for span in spans_1
        ]  # ensure spans don't overlap

        spans_2 = [
            create_span(
                "db",
                span_duration,
                "SELECT `customer`.`id` FROM `customers` WHERE `customer`.`name` = $1",
            ),
            create_span("db", 20, "SELECT `customer`.`id` FROM `customers`..."),
            create_span("db", 20, "SELECT `customer`.`id` FROM `customers`..."),
            create_span("db", 20, "SELECT `customer`.`id` FROM `customers`..."),
            create_span("db", 20, "SELECT `customer`.`id` FROM `customers`..."),
            create_span("db", 20, "SELECT `customer`.`id` FROM `customers`..."),
            create_span("db", 900, "SELECT COUNT(*) FROM `products`"),
        ]
        spans_2 = [
            modify_span_start(span, span_duration * spans_2.index(span)) for span in spans_2
        ]  # ensure spans don't overlap

        event_1 = create_event(spans_1)
        event_2 = create_event(spans_2)

        fingerprint_1 = self.find_problems(event_1)[0].fingerprint
        fingerprint_2 = self.find_problems(event_2)[0].fingerprint

        assert fingerprint_1 == fingerprint_2

    def test_respects_project_option(self):
        project = self.create_project()
        event = self.create_issue_event()
        event["project_id"] = project.id

        settings = get_detection_settings(project.id)
        detector = ConsecutiveDBSpanDetector(settings, event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"consecutive_db_queries_detection_enabled": False},
        )

        settings = get_detection_settings(project.id)
        detector = ConsecutiveDBSpanDetector(settings, event)

        assert not detector.is_creation_allowed_for_project(project)

    def test_detects_consecutive_db_does_not_detect_php(self):
        event = self.create_issue_event()

        assert len(self.find_problems(event)) == 1

        event["sdk"] = {"name": "sentry.php.laravel"}

        assert self.find_problems(event) == []

    def test_ignores_events_with_low_time_saving_ratio(self):
        span_duration = 100
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
            create_span("db", 3000, "SELECT COUNT(*) FROM `products`"),
        ]
        spans = [
            modify_span_start(span, span_duration * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap

        event = create_event(spans)

        assert self.find_problems(event) == []

    def test_ignores_graphql(self):
        event = self.create_issue_event()
        event["request"] = {"url": "https://url.dev/api/my-endpoint", "method": "POST"}
        assert len(self.find_problems(event)) == 1
        event["request"]["url"] = "https://url.dev/api/graphql"
        assert self.find_problems(event) == []
