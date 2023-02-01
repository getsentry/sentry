import unittest
from typing import List

import pytest

from sentry.eventstore.models import Event
from sentry.spans.grouping.api import load_span_grouping_config
from sentry.testutils.performance_issues.event_generators import (
    PROJECT_ID,
    create_span,
    modify_span_start,
)
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.performance_detection import (
    GroupType,
    PerformanceProblem,
    RenderBlockingAssetSpanDetector,
    get_detection_settings,
    run_detector_on_data,
)


@region_silo_test
@pytest.mark.django_db
class RenderBlockingAssetDetectorTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()
        self.hash_config = load_span_grouping_config()

    def find_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = RenderBlockingAssetSpanDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def _valid_render_blocking_asset_event(self, url: str) -> Event:
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "measurements": {
                "fcp": {
                    "value": 2500.0,
                    "unit": "millisecond",
                }
            },
            "spans": [
                create_span(
                    "resource.script",
                    desc=url,
                    duration=1000.0,
                    data={
                        "Transfer Size": 1200000,
                        "Encoded Body Size": 1200000,
                        "Decoded Body Size": 2000000,
                    },
                ),
            ],
            "contexts": {
                "trace": {
                    "span_id": "c" * 16,
                }
            },
            "transaction": "/",
        }
        self.hash_config.execute_strategy(event).write_to_event(event)
        return event

    def test_detects_render_blocking_asset(self):
        event = self._valid_render_blocking_asset_event("https://example.com/a.js")
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1004-ba43281143a88ba902029356cb543dd0bff8f41c",
                op="resource.script",
                desc="https://example.com/a.js",
                type=GroupType.PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
            )
        ]

    def test_not_detect_render_block_asset(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "measurements": {
                "fcp": {
                    "value": 2500.0,
                    "unit": "millisecond",
                }
            },
            "spans": [
                modify_span_start(
                    create_span("resource.script", duration=1000.0),
                    2000.0,
                ),
            ],
        }

        assert self.find_problems(event) == []

    def test_does_not_detect_with_no_fcp(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "measurements": {
                "fcp": {
                    "value": None,
                    "unit": "millisecond",
                }
            },
            "spans": [
                create_span("resource.script", duration=1000.0),
            ],
        }

        assert self.find_problems(event) == []

    def test_does_not_detect_with_no_measurements(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "measurements": None,
            "spans": [
                create_span("resource.script", duration=1000.0),
            ],
        }

        assert self.find_problems(event) == []

    def test_does_not_detect_with_short_render_blocking_asset(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "measurements": {
                "fcp": {
                    "value": 2500.0,
                    "unit": "millisecond",
                }
            },
            "spans": [
                create_span("resource.script", duration=200.0),
            ],
        }

        assert self.find_problems(event) == []

    def test_assets_with_different_urls_have_different_fingerprints(self):
        first_event = self._valid_render_blocking_asset_event("https://example.com/foo.js")
        second_event = self._valid_render_blocking_asset_event("https://example.com/bar.js")

        first_problems = self.find_problems(first_event)
        second_problems = self.find_problems(second_event)

        assert len(first_problems) == 1
        assert len(second_problems) == 1
        assert first_problems[0].fingerprint != second_problems[0].fingerprint

    def test_assets_with_different_query_strings_have_same_fingerprint(self):
        first_event = self._valid_render_blocking_asset_event("https://example.com/a.js?foo")
        second_event = self._valid_render_blocking_asset_event("https://example.com/a.js?bar")

        first_problems = self.find_problems(first_event)
        second_problems = self.find_problems(second_event)

        assert len(first_problems) == 1
        assert len(second_problems) == 1
        assert first_problems[0].fingerprint == second_problems[0].fingerprint

    def test_assets_with_different_rails_content_hashes_have_same_fingerprint(self):
        first_event = self._valid_render_blocking_asset_event(
            "https://example.com/global-908e25f4bf641868d8683022a5b62f54.css"
        )
        second_event = self._valid_render_blocking_asset_event(
            "https://example.com/global-c2abefee2aa141eeb2e61a2c6bbf0d53.css"
        )

        first_problems = self.find_problems(first_event)
        second_problems = self.find_problems(second_event)

        assert len(first_problems) == 1
        assert len(second_problems) == 1
        assert first_problems[0].fingerprint == second_problems[0].fingerprint

    def test_does_not_detect_if_too_small(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "measurements": {
                "fcp": {
                    "value": 2500.0,
                    "unit": "millisecond",
                }
            },
            "spans": [
                create_span(
                    "resource.script",
                    duration=1000.0,
                    data={
                        "Transfer Size": 900000,
                        "Encoded Body Size": 900000,
                        "Decoded Body Size": 1700000,
                    },
                ),
            ],
        }
        assert self.find_problems(event) == []

    def test_does_not_detect_if_missing_size(self):
        event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "measurements": {
                "fcp": {
                    "value": 2500.0,
                    "unit": "millisecond",
                }
            },
            "spans": [
                create_span("resource.script", duration=1000.0),
            ],
        }
        assert self.find_problems(event) == []
