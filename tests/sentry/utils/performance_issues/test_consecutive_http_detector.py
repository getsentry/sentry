from __future__ import annotations

from typing import Any

import pytest

from sentry.issues.grouptype import PerformanceConsecutiveHTTPQueriesGroupType
from sentry.models.options.project_option import ProjectOption
from sentry.spans.grouping.strategy.base import Span
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import (
    create_event,
    create_span,
    modify_span_start,
)
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.detectors.consecutive_http_detector import (
    ConsecutiveHTTPSpanDetector,
)
from sentry.utils.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem

MIN_SPAN_DURATION = 900  # ms


@region_silo_test
@pytest.mark.django_db
class ConsecutiveHTTPSpansDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = ConsecutiveHTTPSpanDetector(self._settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def create_issue_spans(self, span_duration=2000) -> list[Span]:
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
        ]
        spans = [
            modify_span_start(span, span_duration * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap

        return spans

    def create_issue_event(self, span_duration=2000):
        spans = self.create_issue_spans(span_duration)
        return create_event(spans)

    def test_detects_consecutive_http_issue(self):
        event = self.create_issue_event()
        problems = self.find_problems(event)

        assert problems == [
            PerformanceProblem(
                fingerprint="1-1009-00b8644b56309c8391aa365783145162ab9c589a",
                op="http",
                desc="GET /api/0/organizations/endpoint1",
                type=PerformanceConsecutiveHTTPQueriesGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=[
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                ],
                evidence_data={
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": [
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                    ],
                    "op": "http",
                },
                evidence_display=[],
            )
        ]

    def test_does_not_detects_consecutive_http_issue_low_time_saved(self):
        spans = [  # min time saved by parallelizing is 2s
            create_span("http.client", 1000, "GET /api/0/organizations/endpoint1", "hash1"),
            create_span("http.client", 1000, "GET /api/0/organizations/endpoint2", "hash2"),
            create_span("http.client", 1000, "GET /api/0/organizations/endpoint3", "hash3"),
        ]
        spans = [
            modify_span_start(span, 1000 * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap
        problems = self.find_problems(create_event(spans))

        assert len(problems) == 1

        spans = [  # min time saved by parallelizing is 1s
            create_span("http.client", 500, "GET /api/0/organizations/endpoint1", "hash1"),
            create_span("http.client", 500, "GET /api/0/organizations/endpoint2", "hash2"),
            create_span("http.client", 1000, "GET /api/0/organizations/endpoint3", "hash3"),
        ]
        spans = [
            modify_span_start(span, 1000 * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap

        problems = self.find_problems(create_event(spans))

        assert problems == []

    def test_does_not_detect_consecutive_http_issue_with_frontend_events(self):
        event = {
            **self.create_issue_event(),
            "sdk": {"name": "sentry.javascript.browser"},
        }
        problems = self.find_problems(event)
        assert problems == []

    def test_does_not_detect_consecutive_http_issue_with_low_count(self):
        spans = [  # all thresholds are exceeded, except count
            create_span("http.client", 3000, "GET /api/0/organizations/endpoint1", "hash1"),
            create_span("http.client", 3000, "GET /api/0/organizations/endpoint2", "hash2"),
        ]
        spans = [
            modify_span_start(span, 3000 * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap
        problems = self.find_problems(create_event(spans))

        assert problems == []

    def test_detects_consecutive_http_issue_with_trailing_low_duration_span(self):
        spans = [
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint1", "hash1"
            ),  # all thresholds are exceeded.
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint2", "hash2"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint3", "hash3"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint4", "hash4"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint5", "hash5"
            ),
        ]
        spans = [
            modify_span_start(span, MIN_SPAN_DURATION * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap
        problems = self.find_problems(create_event(spans))

        assert len(problems) == 1

        spans = [
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint1", "hash1"
            ),  # some spans with low durations, all other thresholds are exceeded.
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint2", "hash2"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint3", "hash3"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint4", "hash4"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint5", "hash5"
            ),
            create_span("http.client", 400, "GET /api/0/organizations/endpoint6", "hash6"),
        ]
        spans = [
            modify_span_start(span, MIN_SPAN_DURATION * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap
        problems = self.find_problems(create_event(spans))

        assert len(problems) == 1

    def test_does_not_detect_consecutive_http_issue_with_low_duration_spans(self):
        spans = [
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint1", "hash1"
            ),  # all thresholds are exceeded.
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint2", "hash2"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint3", "hash3"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint4", "hash4"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint5", "hash5"
            ),
        ]
        spans = [
            modify_span_start(span, MIN_SPAN_DURATION * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap
        problems = self.find_problems(create_event(spans))

        assert len(problems) == 1

        spans = [
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint1", "hash1"
            ),  # some spans with low durations, all other thresholds are exceeded.
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint2", "hash2"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint3", "hash3"
            ),
            create_span("http.client", 400, "GET /api/0/organizations/endpoint4", "hash4"),
            create_span("http.client", 400, "GET /api/0/organizations/endpoint5", "hash5"),
            create_span("http.client", 400, "GET /api/0/organizations/endpoint5", "hash5"),
        ]
        spans = [
            modify_span_start(span, MIN_SPAN_DURATION * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap
        problems = self.find_problems(create_event(spans))

        assert problems == []

    def test_detects_consecutive_http_issue_with_low_duration_spans(self):
        spans = [
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint1", "hash1"
            ),  # spans with low durations, but min_time_saved
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint2", "hash2"
            ),  # exceeds threshold
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint3", "hash3"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint4", "hash4"
            ),
            create_span(
                "http.client", MIN_SPAN_DURATION, "GET /api/0/organizations/endpoint5", "hash5"
            ),
        ]
        spans = [
            modify_span_start(span, MIN_SPAN_DURATION * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap
        problems = self.find_problems(create_event(spans))

        assert len(problems) == 1

    def test_detects_consecutive_with_non_http_between_http_spans(self):
        spans = self.create_issue_spans()

        spans.insert(
            1, modify_span_start(create_span("resource.script", 500, "/static/js/bundle.js"), 2000)
        )

        event = create_event(spans)

        problems = self.find_problems(event)

        assert problems == [
            PerformanceProblem(
                fingerprint="1-1009-00b8644b56309c8391aa365783145162ab9c589a",
                op="http",
                desc="GET /api/0/organizations/endpoint1",
                type=PerformanceConsecutiveHTTPQueriesGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=[
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                ],
                evidence_data={
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": [
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                    ],
                    "op": "http",
                },
                evidence_display=[],
            )
        ]

    def test_does_not_detect_nextjs_asset(self):
        span_duration = 2000  # ms
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
        ]
        spans = [modify_span_start(span, span_duration * spans.index(span)) for span in spans]

        assert len(self.find_problems(create_event(spans))) == 1

        spans[0] = modify_span_start(
            create_span("http.client", 2000, "GET /_next/static/css/file-hash-abc.css", "hash4"),
            0,
        )

        assert self.find_problems(create_event(spans)) == []

    def test_does_not_detect_with_high_duration_between_spans(self):
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
        ]

        spans = [
            modify_span_start(span, (10000 + span_duration) * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap

        assert self.find_problems(create_event(spans)) == []

    def test_fingerprints_match_with_duplicate_http(self):
        span_duration = 2000
        spans = [
            create_span("http.client", span_duration, "GET /api/endpoint1", "hash1"),
            create_span("http.client", span_duration, "GET /api/endpoint2", "hash2"),
            create_span("http.client", span_duration, "GET /api/endpoint3", "hash3"),
        ]

        spans = [
            modify_span_start(span, span_duration * spans.index(span)) for span in spans
        ]  # ensure spans don't overlap

        problem_1 = self.find_problems(create_event(spans))[0]

        spans.append(
            modify_span_start(
                create_span("http.client", span_duration, "GET /api/endpoint3", "hash3"), 6000
            )
        )

        problem_2 = self.find_problems(create_event(spans))[0]

        assert problem_2.fingerprint == "1-1009-515a42c2614f98fa886b6d9ad1ddfe1929329f53"
        assert problem_1.fingerprint == problem_2.fingerprint

    def test_respects_project_option(self):
        project = self.create_project()
        event = self.create_issue_event()

        settings = get_detection_settings(project.id)
        detector = ConsecutiveHTTPSpanDetector(settings, event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"consecutive_http_spans_detection_enabled": False},
        )

        settings = get_detection_settings(project.id)
        detector = ConsecutiveHTTPSpanDetector(settings, event)

        assert not detector.is_creation_allowed_for_project(project)
