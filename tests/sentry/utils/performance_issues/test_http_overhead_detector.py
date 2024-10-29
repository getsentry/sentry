from __future__ import annotations

from typing import Any

import pytest

from sentry.issues.grouptype import PerformanceHTTPOverheadGroupType
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import (
    PROJECT_ID,
    create_span,
    modify_span_start,
)
from sentry.utils.performance_issues.detectors.http_overhead_detector import HTTPOverheadDetector
from sentry.utils.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


def overhead_span(
    duration: float, request_start: float, url: str, span_start=1.0, span_id="b" * 16
) -> dict[str, Any]:
    span = create_span(
        "http.client",
        desc=url,
        duration=duration,
        data={
            "url": url,
            "network.protocol.version": "1.1",
            "http.request.request_start": request_start / 1000.0,
        },
    )
    span["span_id"] = span_id
    return modify_span_start(
        span,
        span_start,
    )


def _valid_http_overhead_event(url: str) -> dict[str, Any]:
    return {
        "event_id": "a" * 16,
        "project": PROJECT_ID,
        "spans": [
            overhead_span(1000, 100, url),
            overhead_span(1000, 200, url),
            overhead_span(1000, 300, url),
            overhead_span(1000, 400, url),
            overhead_span(1000, 500, url),
            overhead_span(1000, 600, url),
        ],
        "contexts": {
            "trace": {
                "span_id": "c" * 16,
            }
        },
        "transaction": url,
    }


def find_problems(settings, event: dict[str, Any]) -> list[PerformanceProblem]:
    detector = HTTPOverheadDetector(settings, event)
    run_detector_on_data(detector, event)
    return list(detector.stored_problems.values())


@pytest.mark.django_db
class HTTPOverheadDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event):
        return find_problems(self._settings, event)

    def test_detects_http_overhead(self):
        event = _valid_http_overhead_event("/api/endpoint/123")
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1016-/",
                op="http",
                desc="/api/endpoint/123",
                type=PerformanceHTTPOverheadGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=[
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                ],
                evidence_data={
                    "op": "http",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": [
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                    ],
                },
                evidence_display=[],
            )
        ]

    def test_does_not_detect_overlap_limit(self):
        event = _valid_http_overhead_event("/api/endpoint/123")

        event["spans"] = event["spans"][:5]
        assert self.find_problems(event) == []

    def test_slowest_span_description_used(self):
        url = "/api/endpoint/123"
        event = _valid_http_overhead_event("/api/endpoint/123")
        event["spans"] = [
            overhead_span(1000, 1, url),
            overhead_span(1000, 2, url),
            overhead_span(1000, 3, url),
            overhead_span(1000, 4, url),
            overhead_span(1000, 5, url),
            overhead_span(1000, 502, "/api/endpoint/slowest"),
        ]

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1016-/",
                op="http",
                desc="/api/endpoint/slowest",
                type=PerformanceHTTPOverheadGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=[
                    "bbbbbbbbbbbbbbbb",
                ],
                evidence_data={
                    "op": "http",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": [
                        "bbbbbbbbbbbbbbbb",
                    ],
                },
                evidence_display=[],
            )
        ]

    def test_does_not_detect_under_delay_threshold(self):
        url = "/api/endpoint/123"
        event = _valid_http_overhead_event(url)

        event["spans"] = [
            overhead_span(1000, 1, url),
            overhead_span(1000, 2, url),
            overhead_span(1000, 3, url),
            overhead_span(1000, 4, url),
            overhead_span(1000, 5, url),
            overhead_span(1000, 501, url),  # Request start is at 1ms.
        ]
        assert self.find_problems(event) == []

    def test_detect_non_http_1_1(self):
        url = "/api/endpoint/123"
        event = _valid_http_overhead_event(url)

        trigger_span = overhead_span(1000, 502, url)
        event["spans"] = [
            overhead_span(1000, 1, url),
            overhead_span(1000, 2, url),
            overhead_span(1000, 3, url),
            overhead_span(1000, 4, url),
            overhead_span(1000, 5, url),
            trigger_span,
        ]

        assert len(self.find_problems(event)) == 1

        trigger_span["data"]["network.protocol.version"] = "h3"

        assert len(self.find_problems(event)) == 0

    def test_non_overlapping_not_included_evidence(self):
        url = "https://example.com/api/endpoint/123"
        event = _valid_http_overhead_event(url)
        event["spans"] = [
            overhead_span(1000, 1, url),
            overhead_span(1000, 2, url),
            overhead_span(1000, 3, url),
            overhead_span(1000, 4, url),
            overhead_span(1000, 5, url),
            overhead_span(1000, 502, url, 1, "c" * 16),
            overhead_span(1000, 2001, url, 2000),
            overhead_span(1000, 2002, url, 2000),
            overhead_span(1000, 2003, url, 2000),
            overhead_span(1000, 2104, url, 2000),
            overhead_span(1000, 2105, url, 2000),
            overhead_span(1000, 2502, url, 2000, "d" * 16),  # Separated group
        ]
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1016-example.com",
                op="http",
                desc="/api/endpoint/123",
                type=PerformanceHTTPOverheadGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=[
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "dddddddddddddddd",
                ],
                evidence_data={
                    "op": "http",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": [
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                        "dddddddddddddddd",
                    ],
                },
                evidence_display=[],
            )
        ]

    def test_detect_other_location(self):
        url = "https://example.com/api/endpoint/123"
        event = _valid_http_overhead_event(url)
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1016-example.com",
                op="http",
                desc="/api/endpoint/123",
                type=PerformanceHTTPOverheadGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=[
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                    "bbbbbbbbbbbbbbbb",
                ],
                evidence_data={
                    "op": "http",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": [
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                        "bbbbbbbbbbbbbbbb",
                    ],
                },
                evidence_display=[],
            )
        ]

    def test_none_request_start(self):
        url = "https://example.com/api/endpoint/123"
        event = _valid_http_overhead_event("/api/endpoint/123")

        # Include an invalid span to ensure it's not processed
        span = create_span(
            "http.client",
            desc=url,
            duration=1000,
            data={
                "url": url,
                "network.protocol.version": "1.1",
                "http.request.request_start": None,
            },
        )

        event["spans"] = [span]

        assert self.find_problems(event) == []
