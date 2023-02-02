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


def _valid_render_blocking_asset_event(url: str) -> Event:
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
    return event


def find_problems(settings, event: Event) -> List[PerformanceProblem]:
    detector = RenderBlockingAssetSpanDetector(settings, event)
    run_detector_on_data(detector, event)
    return list(detector.stored_problems.values())


@region_silo_test
@pytest.mark.django_db
class RenderBlockingAssetDetectorTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def find_problems(self, event):
        return find_problems(self.settings, event)

    def test_detects_render_blocking_asset(self):
        event = _valid_render_blocking_asset_event("https://example.com/a.js")
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


@pytest.mark.parametrize(
    "expected,first_url,second_url",
    [
        # same path
        (True, "/foo.js", "/foo.js"),
        # different path
        (False, "/foo.js", "/bar.js"),
        # different query strings
        (True, "/foo.js?bar", "/foo.js?baz"),
        # same file chunks
        (
            True,
            "/foo.6a7a65d8.chunk.js",
            "/foo.9aa723de.chunk.js",
        ),
        # different file chunks
        (
            False,
            "/foo.6a7a65d8.chunk.js",
            "/bar.9aa723de.chunk.js",
        ),
        # numbered chunks
        (True, "/2.6a7a65d8.chunk.js", "/3.9aa723de.chunk.js"),
        # same file, trailing hashes (dot)
        (True, "/foo.6a7a65d8.js", "/foo.9aa723de.js"),
        # same file, trailing hashes (dash)
        (
            True,
            "/foo-6a7a65d8bf641868d8683022a5b62f54.js",
            "/foo-9aa723de2aa141eeb2e61a2c6bbf0d53.js",
        ),
        # same file, trailing hashes, different extension
        (True, "/foo.6a7a65d8.woff2", "/foo.9aa723de.woff2"),
        # different file, trailing hashes (dot)
        (False, "/foo.6a7a65d8.js", "/bar.9aa723de.js"),
        # different file, trailing hashes (dash)
        (
            False,
            "/foo-6a7a65d8bf641868d8683022a5b62f54.js",
            "/bar-9aa723de2aa141eeb2e61a2c6bbf0d53.js",
        ),
        # filename is just a hash
        (
            True,
            "/6a7a65d8bf641868d868.js",
            "/9aa723de2aa141eeb2e6.js",
        ),
        # filename is a hash, but too short to avoid false positives
        (
            False,
            "/6a7a65d8.js",
            "/9aa723de.js",
        ),
        # path contains a hash
        (
            True,
            "/6a7a65d8bf641868d868/foo.js",
            "/9aa723de2aa141eeb2e6/foo.js",
        ),
        # path contains a hash, but too short to avoid false positives
        (
            False,
            "/6a7a65d8/foo.js",
            "/9aa723de/foo.js",
        ),
        # filename is a UUID
        (
            True,
            "/6a7a65d8-bf64-1868-d868-3022a5b62f54.js",
            "/9aa723de-2aa1-41ee-b2e6-1a2c6bbf0d53.js",
        ),
    ],
)
def test_fingerprint_similarity(expected, first_url, second_url):
    first_event = _valid_render_blocking_asset_event(first_url)
    second_event = _valid_render_blocking_asset_event(second_url)
    settings = get_detection_settings()
    first_problems = find_problems(settings, first_event)
    second_problems = find_problems(settings, second_event)
    assert len(first_problems) == 1
    assert len(second_problems) == 1
    if expected:
        assert first_problems[0].fingerprint == second_problems[0].fingerprint
    else:
        assert first_problems[0].fingerprint != second_problems[0].fingerprint
