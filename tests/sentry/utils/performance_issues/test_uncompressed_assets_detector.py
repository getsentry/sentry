import unittest
from typing import List

import pytest

from sentry.eventstore.models import Event
from sentry.testutils.performance_issues.event_generators import PROJECT_ID, create_span
from sentry.testutils.performance_issues.span_builder import SpanBuilder
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.performance_detection import (
    GroupType,
    PerformanceProblem,
    UncompressedAssetSpanDetector,
    get_detection_settings,
    run_detector_on_data,
)


def create_asset_span(
    op="resource.script",
    desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
    duration=1000.0,
    data=None,
) -> "SpanBuilder":
    return create_span("resource.script", desc=desc, duration=duration, data=data)


@region_silo_test
@pytest.mark.django_db
class UncompressedAssetsDetectorTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def find_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = UncompressedAssetSpanDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_uncompressed_asset(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "spans": [
                create_asset_span(
                    duration=1000.0,
                    data={
                        "Transfer Size": 1_000_000,
                        "Encoded Body Size": 1_000_000,
                        "Decoded Body Size": 1_000_000,
                    },
                )
            ],
        }

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1012-da39a3ee5e6b4b0d3255bfef95601890afd80709",
                op="resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
                type=GroupType.PERFORMANCE_UNCOMPRESSED_ASSETS,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
            )
        ]

    def test_detects_uncompressed_asset_stylesheet(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "spans": [
                create_asset_span(
                    op="resource.link",
                    desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.css",
                    duration=1000.0,
                    data={
                        "Transfer Size": 1_000_000,
                        "Encoded Body Size": 1_000_000,
                        "Decoded Body Size": 1_000_000,
                    },
                )
            ],
        }

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1012-da39a3ee5e6b4b0d3255bfef95601890afd80709",
                op="resource.script",
                desc="https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.css",
                type=GroupType.PERFORMANCE_UNCOMPRESSED_ASSETS,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
            )
        ]

    def test_ignores_assets_under_size(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "spans": [
                create_asset_span(
                    duration=1000.0,
                    data={
                        "Transfer Size": 1_000_000,
                        "Encoded Body Size": 99_999,
                        "Decoded Body Size": 99_999,
                    },
                )
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
                        "Transfer Size": 1_000_000,
                        "Encoded Body Size": 101_000,
                        "Decoded Body Size": 100_999,
                    },
                )
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
                        "Transfer Size": 1_000_000,
                        "Encoded Body Size": 101_000,
                        "Decoded Body Size": 101_000,
                    },
                )
            ],
        }

        assert len(self.find_problems(event)) == 0
