from __future__ import annotations

from typing import Any

import pytest

from sentry.issues.grouptype import PerformanceUncompressedAssetsGroupType
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import PROJECT_ID, create_span, get_event
from sentry.testutils.performance_issues.span_builder import SpanBuilder
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.detectors.uncompressed_asset_detector import (
    UncompressedAssetSpanDetector,
)
from sentry.utils.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


def create_asset_span(
    op="resource.script",
    desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
    duration=1000.0,
    data=None,
) -> SpanBuilder:
    return create_span("resource.script", desc=desc, duration=duration, data=data)


def create_compressed_asset_span():
    return create_asset_span(
        desc="https://someothersite.example.com/app.js",
        duration=1.0,
        data={
            "http.response_transfer_size": 5,
            "http.response_content_length": 4,
            "http.decoded_response_content_length": 5,
        },
    )


@region_silo_test
@pytest.mark.django_db
class UncompressedAssetsDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = UncompressedAssetSpanDetector(self._settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_uncompressed_asset_with_none_tag(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "tags": [None, ["browser.name", "chrome"]],
            "spans": [
                create_asset_span(
                    duration=1000.0,
                    data={
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 1_000_000,
                        "http.decoded_response_content_length": 1_000_000,
                    },
                ),
                create_compressed_asset_span(),
            ],
        }

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1012-6893fb5a8a875d692da96590f40dc6bddd6fcabc",
                op="resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
                type=PerformanceUncompressedAssetsGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "resource.script",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
            )
        ]

    def test_detects_uncompressed_asset(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "tags": [["browser.name", "chrome"]],
            "spans": [
                create_asset_span(
                    duration=1000.0,
                    data={
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 1_000_000,
                        "http.decoded_response_content_length": 1_000_000,
                    },
                ),
                create_compressed_asset_span(),
            ],
        }

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1012-6893fb5a8a875d692da96590f40dc6bddd6fcabc",
                op="resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
                type=PerformanceUncompressedAssetsGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "resource.script",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
            )
        ]

    def test_detects_uncompressed_asset_with_trailing_query_params(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "tags": [["browser.name", "chrome"]],
            "spans": [
                create_asset_span(
                    duration=1000.0,
                    data={
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 1_000_000,
                        "http.decoded_response_content_length": 1_000_000,
                    },
                    desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js?query_string=content",
                ),
                create_compressed_asset_span(),
            ],
        }

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1012-6893fb5a8a875d692da96590f40dc6bddd6fcabc",
                op="resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js?query_string=content",
                type=PerformanceUncompressedAssetsGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "resource.script",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
            )
        ]

    def test_detects_uncompressed_asset_stylesheet(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "tags": [["browser.name", "chrome"]],
            "spans": [
                create_asset_span(
                    op="resource.link",
                    desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.css",
                    duration=1000.0,
                    data={
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 1_000_000,
                        "http.decoded_response_content_length": 1_000_000,
                    },
                ),
                create_compressed_asset_span(),
            ],
        }

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1012-7f5aaccd4a1347f512fc3d04068b9621baff2783",
                op="resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.css",
                type=PerformanceUncompressedAssetsGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "resource.script",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
            )
        ]

    def test_does_not_detect_jpg_asset(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "tags": [["browser.name", "chrome"]],
            "spans": [
                create_asset_span(
                    op="resource.link",
                    desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.css",
                    duration=1000.0,
                    data={
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 1_000_000,
                        "http.decoded_response_content_length": 1_000_000,
                    },
                ),
                create_compressed_asset_span(),
            ],
        }

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1012-7f5aaccd4a1347f512fc3d04068b9621baff2783",
                op="resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.css",
                type=PerformanceUncompressedAssetsGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "resource.script",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
            )
        ]

        event["spans"] = [
            create_asset_span(
                op="resource.css",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/some.jpg",
                duration=1000.0,
                data={
                    "http.response_transfer_size": 1_000_000,
                    "http.response_content_length": 1_000_000,
                    "http.decoded_response_content_length": 1_000_000,
                },
            ),
            create_compressed_asset_span(),
        ]

        assert self.find_problems(event) == []

    def test_does_not_detect_woff_asset(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "tags": [["browser.name", "chrome"]],
            "spans": [
                create_asset_span(
                    op="resource.link",
                    desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.css",
                    duration=1000.0,
                    data={
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 1_000_000,
                        "http.decoded_response_content_length": 1_000_000,
                    },
                ),
                create_compressed_asset_span(),
            ],
        }

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1012-7f5aaccd4a1347f512fc3d04068b9621baff2783",
                op="resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.css",
                type=PerformanceUncompressedAssetsGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "resource.script",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
            )
        ]

        event["spans"] = [
            create_asset_span(
                op="resource.css",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.woff2",
                duration=1000.0,
                data={
                    "http.response_transfer_size": 1_000_000,
                    "http.response_content_length": 1_000_000,
                    "http.decoded_response_content_length": 1_000_000,
                },
            ),
            create_compressed_asset_span(),
        ]

        assert self.find_problems(event) == []

    def test_does_not_detect_mobile_uncompressed_asset(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "tags": [["browser.name", "firefox_mobile"]],
            "spans": [
                create_asset_span(
                    duration=1000.0,
                    data={
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 1_000_000,
                        "http.decoded_response_content_length": 1_000_000,
                    },
                ),
                create_compressed_asset_span(),
            ],
        }

        assert len(self.find_problems(event)) == 0

    def test_ignores_assets_under_size(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "spans": [
                create_asset_span(
                    duration=1000.0,
                    data={
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 99_999,
                        "http.decoded_response_content_length": 99_999,
                    },
                ),
                create_compressed_asset_span(),
            ],
        }

        assert len(self.find_problems(event)) == 0

    def test_ignores_compressed_assets(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "spans": [
                create_asset_span(
                    duration=1000.0,
                    data={
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 101_000,
                        "http.decoded_response_content_length": 100_999,
                    },
                ),
                create_compressed_asset_span(),
            ],
        }

        assert len(self.find_problems(event)) == 0

    def test_ignores_assets_under_duration(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "spans": [
                create_asset_span(
                    duration=50.0,
                    data={
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 101_000,
                        "http.decoded_response_content_length": 101_000,
                    },
                ),
                create_compressed_asset_span(),
            ],
        }

        assert len(self.find_problems(event)) == 0

    def test_respects_feature_flag(self):
        project = self.create_project()
        event = get_event("uncompressed-assets/uncompressed-script-asset")

        detector = UncompressedAssetSpanDetector(self._settings, event)

        assert not detector.is_creation_allowed_for_organization(project.organization)

        with self.feature({"organizations:performance-issues-compressed-assets-detector": True}):
            assert detector.is_creation_allowed_for_organization(project.organization)

    def test_detects_problems_from_event(self):
        event = get_event("uncompressed-assets/uncompressed-script-asset")

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1012-385f4476d848360e4cb90cbe31457f6bba5bd6a9",
                op="resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/chunks/app_components_charts_utils_tsx-app_utils_performance_quickTrace_utils_tsx-app_utils_withPage-3926ec.bc434924850c44d4057f.js",
                type=PerformanceUncompressedAssetsGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["b66a5642da1edb52"],
                evidence_data={
                    "op": "resource.script",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["b66a5642da1edb52"],
                },
                evidence_display=[],
            ),
        ]

    def test_respects_project_option(self):
        project = self.create_project()
        event = get_event("uncompressed-assets/uncompressed-script-asset")
        event["project_id"] = project.id

        settings = get_detection_settings(project.id)
        detector = UncompressedAssetSpanDetector(settings, event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"uncompressed_assets_detection_enabled": False},
        )

        settings = get_detection_settings(project.id)
        detector = UncompressedAssetSpanDetector(settings, event)

        assert not detector.is_creation_allowed_for_project(project)
