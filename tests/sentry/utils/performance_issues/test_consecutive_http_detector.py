from typing import List

import pytest

from sentry.eventstore.models import Event
from sentry.issues.grouptype import PerformanceConsecutiveHTTPQueriesGroupType
from sentry.testutils import TestCase
from sentry.testutils.performance_issues.event_generators import (
    create_event,
    create_span,
    modify_span_start,
)
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.detectors import ConsecutiveHTTPSpanDetector
from sentry.utils.performance_issues.performance_detection import (
    PerformanceProblem,
    get_detection_settings,
    run_detector_on_data,
)


@region_silo_test
@pytest.mark.django_db
class ConsecutiveDbDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def find_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = ConsecutiveHTTPSpanDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def create_issue_event(self, span_duration=2000):
        spans = [
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint1", "hash1"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint2", "hash2"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint3", "hash3"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint4", "hash4"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint5", "hash5"
            ),
        ]
        spans = [
            modify_span_start(span, span_duration * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap

        return create_event(spans)

    def test_detects_consecutive_http_issue(self):
        event = self.create_issue_event()
        problems = self.find_problems(event)

        assert problems == [
            PerformanceProblem(
                fingerprint="1-1009-e3d915e5dd423874d4bee287a277fafeb6e3245d",
                op="http",
                desc="GET /api/0/organizations/endpoint1",
                type=PerformanceConsecutiveHTTPQueriesGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=[
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                ],
            )
        ]

    def test_does_not_detect_conseucitve_http_issue_with_low_duration(self):
        event = self.create_issue_event(100)
        problems = self.find_problems(event)

        assert problems == []

    def test_detects_consecutive_with_non_http_between_http_spans(self):
        span_duration = 2000
        spans = [
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint1", "hash1"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint2", "hash2"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint3", "hash3"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint4", "hash4"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint5", "hash5"
            ),
        ]

        spans = [
            modify_span_start(span, span_duration * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap

        spans.insert(
            1, modify_span_start(create_span("resource.script", 500, "/static/js/bundle.js"), 2000)
        )

        event = create_event(spans)

        problems = self.find_problems(event)

        assert problems == [
            PerformanceProblem(
                fingerprint="1-1009-e3d915e5dd423874d4bee287a277fafeb6e3245d",
                op="http",
                desc="GET /api/0/organizations/endpoint1",
                type=PerformanceConsecutiveHTTPQueriesGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=[
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                ],
            )
        ]

    def test_does_not_detect_nextjs_asset(self):
        span_duration = 2000
        spans = [
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint1", "hash1"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint2", "hash2"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint3", "hash3"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint4", "hash4"
            ),
            create_span(
                "http.client", span_duration, "GET /api/0/organizations/endpoint5", "hash5"
            ),
        ]

        spans = [
            modify_span_start(span, span_duration * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap
        assert len(self.find_problems(create_event(spans))) == 1

        spans[2] = modify_span_start(
            create_span("http.client", span_duration, "GET /_next/static/css/hash123.css", "hash3"),
            4000,
        )

        assert self.find_problems(create_event(spans)) == 0
