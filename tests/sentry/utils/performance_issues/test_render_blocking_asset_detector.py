import unittest
from copy import deepcopy
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
                fingerprint="1-1004-ae5ce0e354aeee83e6184c77edd50dfb56244ba9",
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

    def test_assets_with_different_query_strings_have_same_fingerprint(self):
        first_event = {
            "event_id": "a" * 16,
            "project": PROJECT_ID,
            "measurements": {
                "fcp": {
                    "value": 2500.0,
                    "unit": "millisecond",
                }
            },
            "spans": [
                create_span("resource.script", desc="https://example.com/a.js?foo", duration=1000.0)
            ],
            "contexts": {
                "trace": {
                    "span_id": "c" * 16,
                }
            },
            "transaction": "/",
        }
        second_event = deepcopy(first_event)
        second_event["spans"] = [
            create_span("resource.script", desc="https://example.com/a.js?bar", duration=1000.0)
        ]

        hash_config = load_span_grouping_config()
        for e in [first_event, second_event]:
            hash_config.execute_strategy(e).write_to_event(e)

        first_problems = self.find_problems(first_event)
        second_problems = self.find_problems(second_event)
        assert len(first_problems) == 1
        assert len(second_problems) == 1
        assert first_problems[0].fingerprint == second_problems[0].fingerprint

    def test_assets_with_different_rails_content_hashes_have_same_fingerprint(self):
        first_event = {
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
                    desc="https://example.com/global-908e25f4bf641868d8683022a5b62f54.css",
                    duration=1000.0,
                )
            ],
            "contexts": {
                "trace": {
                    "span_id": "c" * 16,
                }
            },
            "transaction": "/",
        }
        second_event = deepcopy(first_event)
        second_event["spans"] = [
            create_span(
                "resource.script",
                desc="https://example.com/global-c2abefee2aa141eeb2e61a2c6bbf0d53.css",
                duration=1000.0,
            )
        ]

        hash_config = load_span_grouping_config()
        for e in [first_event, second_event]:
            hash_config.execute_strategy(e).write_to_event(e)

        first_problems = self.find_problems(first_event)
        second_problems = self.find_problems(second_event)
        assert len(first_problems) == 1
        assert len(second_problems) == 1
        assert first_problems[0].fingerprint == second_problems[0].fingerprint
