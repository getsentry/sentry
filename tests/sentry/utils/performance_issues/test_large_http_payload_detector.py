from __future__ import annotations

from typing import Any

import pytest

from sentry.issues.grouptype import PerformanceLargeHTTPPayloadGroupType
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import create_event, create_span
from sentry.utils.performance_issues.detectors.large_payload_detector import (
    LargeHTTPPayloadDetector,
)
from sentry.utils.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


@pytest.mark.django_db
class LargeHTTPPayloadDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = LargeHTTPPayloadDetector(self._settings, event)
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
                    "http.response_transfer_size": 50_000_000,
                    "http.response_content_length": 50_000_000,
                    "http.decoded_response_content_length": 50_000_000,
                },
            ),
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
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                    "op": "http",
                },
                evidence_display=[],
            )
        ]

    def test_respects_project_option(self):
        project = self.create_project()
        spans = [
            create_span(
                "http.client",
                1000,
                "GET /api/0/organizations/endpoint1",
                "hash1",
                data={
                    "http.response_transfer_size": 50_000_000,
                    "http.response_content_length": 50_000_000,
                    "http.decoded_response_content_length": 50_000_000,
                },
            )
        ]
        event = create_event(spans)
        event["project_id"] = project.id

        settings = get_detection_settings(project.id)
        detector = LargeHTTPPayloadDetector(settings, event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"large_http_payload_detection_enabled": False},
        )

        settings = get_detection_settings(project.id)
        detector = LargeHTTPPayloadDetector(settings, event)

        assert not detector.is_creation_allowed_for_project(project)

    def test_does_not_issue_if_url_is_not_an_http_span(self):
        spans = [
            create_span(
                "resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
                duration=1000.0,
                data={
                    "http.response_transfer_size": 50_000_000,
                    "http.response_content_length": 50_000_000,
                    "http.decoded_response_content_length": 50_000_000,
                },
            )
        ]
        event = create_event(spans)
        assert self.find_problems(event) == []

    def test_does_not_issue_if_url_is_not_a_json_asset(self):
        spans = [
            create_span(
                "http.client",
                hash="hash1",
                desc="GET https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.mp3",
                duration=1000.0,
                data={
                    "http.response_transfer_size": 50_000_000,
                    "http.response_content_length": 50_000_000,
                    "http.decoded_response_content_length": 50_000_000,
                },
            )
        ]
        event = create_event(spans)
        assert self.find_problems(event) == []

    def test_issues_if_url_is_a_json_asset(self):
        spans = [
            create_span(
                "http.client",
                hash="hash1",
                desc="GET https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.json",
                duration=1000.0,
                data={
                    "http.response_transfer_size": 50_000_000,
                    "http.response_content_length": 50_000_000,
                    "http.decoded_response_content_length": 50_000_000,
                },
            )
        ]
        event = create_event(spans)
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1015-707544115c386d60b7b550634d582d8e47d9c5dd",
                op="http",
                desc="GET https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.json",
                type=PerformanceLargeHTTPPayloadGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                    "op": "http",
                },
                evidence_display=[],
            )
        ]

    def test_ignores_query_parameters(self):
        spans = [
            create_span(
                "http.client",
                hash="hash1",
                desc="GET https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.json?foo=bar",
                duration=1000.0,
                data={
                    "http.response_transfer_size": 50_000_000,
                    "http.response_content_length": 50_000_000,
                    "http.decoded_response_content_length": 50_000_000,
                },
            )
        ]
        event = create_event(spans)
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1015-707544115c386d60b7b550634d582d8e47d9c5dd",
                op="http",
                desc="GET https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.json",
                type=PerformanceLargeHTTPPayloadGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                    "op": "http",
                },
                evidence_display=[],
            )
        ]

    def test_ignores_query_parameters_with_trailing_slash(self):
        spans = [
            create_span(
                "http.client",
                hash="hash1",
                desc="GET https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.json/?foo=bar",
                duration=1000.0,
                data={
                    "http.response_transfer_size": 50_000_000,
                    "http.response_content_length": 50_000_000,
                    "http.decoded_response_content_length": 50_000_000,
                },
            )
        ]
        event = create_event(spans)
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1015-e84e3f3951f80edcd72d5a0a08adae09e333e2ea",
                op="http",
                desc="GET https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.json",
                type=PerformanceLargeHTTPPayloadGroupType,
                parent_span_ids=None,
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                    "op": "http",
                },
                evidence_display=[],
            )
        ]

    def test_does_not_trigger_detection_for_http_span_lower_than_100_ms_duration(self):
        spans = [
            create_span(
                "http.client",
                hash="hash1",
                desc="GET https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.json/?foo=bar",
                duration=1.0,
                data={
                    "http.response_transfer_size": 50_000_000,
                    "http.response_content_length": 50_000_000,
                    "http.decoded_response_content_length": 50_000_000,
                },
            )
        ]
        event = create_event(spans)
        assert self.find_problems(event) == []

    def test_handles_string_payload_size_threshold(self):

        spans = [
            create_span(
                "http.client",
                1000,
                "GET /api/0/organizations/endpoint1",
                "hash2",
                data={
                    "http.response_transfer_size": "50_000_000",
                    "http.response_content_length": "50_000_000",
                    "http.decoded_response_content_length": "50_000_000",
                },
            ),
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
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                    "op": "http",
                },
                evidence_display=[],
            )
        ]
