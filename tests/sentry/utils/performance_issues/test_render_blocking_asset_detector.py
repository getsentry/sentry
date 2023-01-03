import unittest
from typing import List

import pytest

from sentry.eventstore.models import Event
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

    def find_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = RenderBlockingAssetSpanDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_render_blocking_asset(self):
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

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="6060649d4f8435d88735",
                op="resource.script",
                desc="SELECT count() FROM table WHERE id = %s",
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
