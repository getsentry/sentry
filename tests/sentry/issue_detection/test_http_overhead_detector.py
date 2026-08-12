from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from sentry.issue_detection.detectors.http_overhead_detector import HTTPOverheadDetector
from sentry.issue_detection.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issues.grouptype import PerformanceHTTPOverheadGroupType
from sentry.testutils.cases import TestCase
from sentry.testutils.issue_detection.event_generators import (
    PROJECT_ID,
    create_span,
    get_event,
    modify_span_start,
)


def overhead_span(
    duration: float,
    request_start: float,
    url: str,
    span_start: float = 1.0,
    span_id: str = "b" * 16,
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


def find_problems(settings: dict[str, Any], event: dict[str, Any]) -> list[PerformanceProblem]:
    detector = HTTPOverheadDetector(settings, event)
    run_detector_on_data(detector, event)
    return list(detector.stored_problems.values())


@pytest.mark.django_db
class HTTPOverheadDetectorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        return find_problems(self._settings[HTTPOverheadDetector.settings_key], event)

    def test_detects_http_overhead(self) -> None:
        event = _valid_http_overhead_event("/api/endpoint/123")
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1016-/",
                op="http",
                desc="/api/endpoint/123",
                type=PerformanceHTTPOverheadGroupType,
                parent_span_ids=[],
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

    def test_does_not_detect_overlap_limit(self) -> None:
        event = _valid_http_overhead_event("/api/endpoint/123")

        event["spans"] = event["spans"][:5]
        assert self.find_problems(event) == []

    def test_slowest_span_description_used(self) -> None:
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
                parent_span_ids=[],
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

    def test_does_not_detect_under_delay_threshold(self) -> None:
        url = "/api/endpoint/123"
        event = _valid_http_overhead_event(url)

        event["spans"] = [
            overhead_span(1000, 0, url),
            overhead_span(1000, 200, url),
            overhead_span(1000, 400, url),
            overhead_span(1000, 600, url),
            overhead_span(1000, 800, url),
            overhead_span(1000, 1000, url),
        ]
        assert self.find_problems(event) == []

    def test_detect_non_http_1_1(self) -> None:
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

    def test_non_overlapping_not_included_evidence(self) -> None:
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
                parent_span_ids=[],
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

    def test_detect_other_location(self) -> None:
        url = "https://example.com/api/endpoint/123"
        event = _valid_http_overhead_event(url)
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1016-example.com",
                op="http",
                desc="/api/endpoint/123",
                type=PerformanceHTTPOverheadGroupType,
                parent_span_ids=[],
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

    def test_none_request_start(self) -> None:
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

    def test_handles_valid_string_request_start_values(self) -> None:
        event = _valid_http_overhead_event("/api/endpoint/123")
        event["spans"][0]["data"]["http.request.request_start"] = "0.1"

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1016-/",
                op="http",
                desc="/api/endpoint/123",
                type=PerformanceHTTPOverheadGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"] * 5,
                evidence_data={
                    "op": "http",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"] * 5,
                },
                evidence_display=[],
            )
        ]

    @patch("sentry.issue_detection.detectors.utils.logger.warning")
    def test_handles_invalid_request_start_values(self, mock_logger_warning: MagicMock) -> None:
        url = "https://example.com/api/endpoint/123"
        event = _valid_http_overhead_event("/api/endpoint/123")
        span = create_span(
            "http.client",
            desc=url,
            duration=1000,
            data={"url": url, "network.protocol.version": "1.1"},
        )
        span["start_timestamp"] = 1121
        span["project_id"] = self.project.id
        span["organization_id"] = self.project.organization.id
        event["spans"] = [span]

        for invalid_value in ["dogs are great", "NaN", "[Filtered]"]:
            event["spans"][0]["data"]["http.request.request_start"] = invalid_value

            assert self.find_problems(event) == []
            mock_logger_warning.assert_called_with(
                "issue_detectors.invalid_data",
                extra={
                    "detector": "http_overhead",
                    "span_id": span["span_id"],
                    "trace_id": span["trace_id"],
                    "project_id": span["project_id"],
                    "org_id": span["organization_id"],
                    "key": "http.request.request_start",
                    "value": invalid_value,
                    "error": f"ValueError(\"could not convert string to `request_start` value: '{invalid_value}'\")",
                },
            )

    def test_filtered_url(self) -> None:
        injection_event = get_event("http-overhead/http-overhead-filtered-url")
        assert len(self.find_problems(injection_event)) == 0
