from typing import List

import pytest

from sentry.eventstore.models import Event
from sentry.issues.grouptype import PerformanceLargeHTTPPayloadGroupType
from sentry.testutils import TestCase
from sentry.testutils.performance_issues.event_generators import create_event, create_span
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.detectors import LargeHTTPPayloadDetector
from sentry.utils.performance_issues.performance_detection import (
    PerformanceProblem,
    get_detection_settings,
    run_detector_on_data,
)


@region_silo_test
@pytest.mark.django_db
class LargeHTTPPayloadDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def find_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = LargeHTTPPayloadDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_large_http_payload_issue(self):

        spans = [
            create_span(
                "http.client",
                1000,
                "GET /api/0/organizations/endpoint1",
                "hash1",
                data={
                    "Transfer Size": 50_000_000,
                    "Encoded Body Size": 50_000_000,
                    "Decoded Body Size": 50_000_000,
                },
            )
        ]

        event = create_event(spans)
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1015-5e5543895c0f1f12c2d468da8c7f2d9e4dca81dc",
                op="http",
                desc="GET /api/0/organizations/endpoint1",
                type=PerformanceLargeHTTPPayloadGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids="bbbbbbbbbbbbbbbb",
                evidence_data={
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": "bbbbbbbbbbbbbbbb",
                    "op": "http",
                },
                evidence_display=[],
            )
        ]

    def test_does_not_detect_large_asset(self):
        spans = [
            create_span(
                "resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
                duration=1000.0,
                data={
                    "Transfer Size": 50_000_000,
                    "Encoded Body Size": 50_000_000,
                    "Decoded Body Size": 50_000_000,
                },
            )
        ]
        event = create_event(spans)
        assert self.find_problems(event) == []
