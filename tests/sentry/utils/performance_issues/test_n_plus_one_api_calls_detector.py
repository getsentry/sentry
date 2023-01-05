import unittest
from typing import List

import pytest

from sentry.eventstore.models import Event
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from sentry.utils.performance_issues.performance_detection import (
    NPlusOneAPICallsDetector,
    PerformanceProblem,
    get_detection_settings,
    run_detector_on_data,
)


@region_silo_test
@pytest.mark.django_db
class NPlusOneAPICallsDetectorTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def find_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = NPlusOneAPICallsDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_problems_with_many_concurrent_calls_to_same_url(self):
        event = get_event("n-plus-one-api-calls/n-plus-one-api-calls-in-issue-stream")

        problems = self.find_problems(event)
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_API_CALLS-3b2ee4021cd4e24acd32179932e10553e312786b",
                op="http.client",
                type=GroupType.PERFORMANCE_N_PLUS_ONE_API_CALLS,
                desc="GET /api/0/organizations/sentry/events/?field=replayId&field=count%28%29&per_page=50&query=issue.id%3A",
                parent_span_ids=["a0c39078d1570b00"],
                cause_span_ids=[],
                offender_span_ids=[
                    "ba198ace55bdb20f",
                    "8a20c71faa0fb6a7",
                    "9269c825d935b33a",
                    "9ea82f759505e0f3",
                    "8c55019639e94ab3",
                    "9b86746e9cc7fbf0",
                    "806aa31fe1874495",
                    "bf409b62d9c30197",
                    "896ac7d28addb37f",
                    "9c859aeaf6bfaea9",
                    "950d8f569bbe3d9e",
                    "b19a2811b457e87a",
                    "b566d4ce5b46d4f0",
                    "b33e9da4441a4800",
                    "8b68818410aa45d8",
                    "8ac4e73b53fc2077",
                    "9fe4a1aff019e39e",
                    "b29cd0c0cd85ae85",
                    "b3ff0062caa3ea51",
                    "a3fde2e38a66cc2c",
                    "b78802cd80762f57",
                    "9e2ea4d33b1c1bc6",
                    "bb827dc7a11085f4",
                    "a34089b08b6d0646",
                    "950801c0d7576650",
                ],
            )
        ]
        assert problems[0].title == "N+1 API Calls"

    def test_does_not_detect_problem_with_concurrent_calls_to_different_urls(self):
        event = get_event("n-plus-one-api-calls/not-n-plus-one-api-calls")
        assert self.find_problems(event) == []


@pytest.mark.parametrize(
    "span",
    [
        {
            "span_id": "a",
            "op": "http.client",
            "hash": "b",
            "description": "GET http://service.io/resource",
        },
        {
            "span_id": "a",
            "op": "http.client",
            "description": "GET http://service.io/resource",
            "hash": "a",
            "data": {
                "url": "/resource",
            },
        },
        {
            "span_id": "a",
            "op": "http.client",
            "description": "GET http://service.io/resource",
            "hash": "a",
            "data": {
                "url": {
                    "pathname": "/resource",
                }
            },
        },
        {
            "span_id": "a",
            "op": "http.client",
            "description": "GET http://service.io/resource.json?param=something",
            "hash": "a",
        },
    ],
)
def test_allows_eligible_spans(span):
    assert NPlusOneAPICallsDetector.is_span_eligible(span)


@pytest.mark.parametrize(
    "span",
    [
        {"span_id": "a", "op": None},
        {"op": "http.client"},
        {
            "span_id": "a",
            "op": "http.client",
            "hash": "a",
            "description": "POST http://service.io/resource",
        },
        {
            "span_id": "a",
            "op": "http.client",
            "description": "GET http://service.io/resource.js",
            "hash": "a",
        },
        {
            "span_id": "a",
            "op": "http.client",
            "description": "GET http://service.io/resource",
            "hash": "a",
            "data": {"url": "/resource.js"},
        },
        {
            "span_id": "a",
            "op": "http.client",
            "description": "GET http://service.io/resource?graphql=somequery",
            "hash": "a",
        },
        {
            "span_id": "a",
            "op": "http.client",
            "hash": "b",
            "description": "GET /_next/data/LjdprRSkUtLP0bMUoWLur/items.json?collection=hello",
        },
    ],
)
def test_rejects_ineligible_spans(span):
    assert not NPlusOneAPICallsDetector.is_span_eligible(span)


@pytest.mark.parametrize(
    "event",
    [get_event("n-plus-one-api-calls/not-n-plus-one-api-calls")],
)
def test_allows_eligible_events(event):
    assert NPlusOneAPICallsDetector.is_event_eligible(event)


@pytest.mark.parametrize(
    "event",
    [
        {"contexts": {"trace": {"op": "task"}}},
    ],
)
def test_rejects_ineligible_events(event):
    assert not NPlusOneAPICallsDetector.is_event_eligible(event)
