from typing import List

import pytest

from sentry.eventstore.models import Event
from sentry.issues.grouptype import PerformanceConsecutiveHTTPQueriesGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.spans.grouping.strategy.base import Span
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

    def create_issue_spans(self, span_duration=2000) -> List[Span]:
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
                fingerprint="1-1009-30ce2c8eaf7cae732346206dcd23c3f016e75f64",
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
                },
                evidence_display=[
                    IssueEvidence(name="Transaction Name", value="", important=True),
                    IssueEvidence(
                        name="Offending Spans",
                        value="GET /api/0/organizations/endpoint1",
                        important=True,
                    ),
                    IssueEvidence(
                        name="Offending Spans",
                        value="GET /api/0/organizations/endpoint2",
                        important=True,
                    ),
                    IssueEvidence(
                        name="Offending Spans",
                        value="GET /api/0/organizations/endpoint3",
                        important=True,
                    ),
                ],
            )
        ]

    def test_does_not_detect_consecutive_http_issue_with_low_duration(self):
        event = self.create_issue_event(100)
        problems = self.find_problems(event)

        assert problems == []

    def test_detects_consecutive_with_non_http_between_http_spans(self):
        spans = self.create_issue_spans()

        spans.insert(
            1, modify_span_start(create_span("resource.script", 500, "/static/js/bundle.js"), 2000)
        )

        event = create_event(spans)

        problems = self.find_problems(event)

        assert problems == [
            PerformanceProblem(
                fingerprint="1-1009-30ce2c8eaf7cae732346206dcd23c3f016e75f64",
                op="http",
                desc="GET /api/0/organizations/endpoint1",
                type=PerformanceConsecutiveHTTPQueriesGroupType,
                parent_span_ids="None",
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
                },
                evidence_display=[
                    IssueEvidence(name="Transaction Name", value="", important=True),
                    IssueEvidence(
                        name="Offending Spans",
                        value="GET /api/0/organizations/endpoint1",
                        important=True,
                    ),
                    IssueEvidence(
                        name="Offending Spans",
                        value="GET /api/0/organizations/endpoint2",
                        important=True,
                    ),
                    IssueEvidence(
                        name="Offending Spans",
                        value="GET /api/0/organizations/endpoint3",
                        important=True,
                    ),
                ],
            )
        ]

    def test_does_not_detect_nextjs_asset(self):
        spans = self.create_issue_spans()
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

        assert problem_2.fingerprint == "1-1009-30ce2c8eaf7cae732346206dcd23c3f016e75f64"
        assert problem_1.fingerprint == problem_2.fingerprint
