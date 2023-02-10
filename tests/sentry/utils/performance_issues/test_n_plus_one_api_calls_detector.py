from typing import Callable, List, cast
from uuid import uuid4

import pytest

from sentry.eventstore.models import Event
from sentry.issues.grouptype import PerformanceNPlusOneAPICallsGroupType
from sentry.models import ProjectOption
from sentry.testutils import TestCase
from sentry.testutils.performance_issues.event_generators import (
    create_event,
    create_span,
    get_event,
)
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.detectors import NPlusOneAPICallsDetector
from sentry.utils.performance_issues.detectors.n_plus_one_api_calls_detector import (
    without_query_params,
)
from sentry.utils.performance_issues.performance_detection import (
    DetectorType,
    PerformanceProblem,
    get_detection_settings,
    run_detector_on_data,
)


@region_silo_test
@pytest.mark.django_db
class NPlusOneAPICallsDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def find_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = NPlusOneAPICallsDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def create_event(self, description_maker: Callable[[int], str]) -> Event:
        duration_threshold = (
            self.settings[DetectorType.N_PLUS_ONE_API_CALLS]["duration_threshold"] + 1
        )
        count = self.settings[DetectorType.N_PLUS_ONE_API_CALLS]["count"] + 1
        hash = uuid4().hex[:16]

        event = cast(
            Event,
            create_event(
                [
                    create_span(
                        "http.client",
                        duration_threshold,
                        description_maker(i),
                        hash=hash,
                    )
                    for i in range(count)
                ]
            ),
        )

        return event

    def test_detects_problems_with_many_concurrent_calls_to_same_url(self):
        event = get_event("n-plus-one-api-calls/n-plus-one-api-calls-in-issue-stream")

        problems = self.find_problems(event)
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-1010-d750ce46bb1b13dd5780aac48098d5e20eea682c",
                op="http.client",
                type=PerformanceNPlusOneAPICallsGroupType,
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
        assert problems[0].title == "N+1 API Call"

    def test_does_not_detect_problem_with_unparameterized_urls(self):
        event = get_event("n-plus-one-api-calls/n-plus-one-api-calls-in-weather-app")
        assert self.find_problems(event) == []

    def test_does_not_detect_problem_with_concurrent_calls_to_different_urls(self):
        event = get_event("n-plus-one-api-calls/not-n-plus-one-api-calls")
        assert self.find_problems(event) == []

    def test_respects_feature_flag(self):
        project = self.create_project()
        event = get_event("n-plus-one-api-calls/n-plus-one-api-calls-in-issue-stream")

        detector = NPlusOneAPICallsDetector(self.settings, event)

        assert not detector.is_creation_allowed_for_organization(project.organization)

        with self.feature({"organizations:performance-n-plus-one-api-calls-detector": True}):
            assert detector.is_creation_allowed_for_organization(project.organization)

    def test_respects_project_option(self):
        project = self.create_project()
        event = get_event("n-plus-one-api-calls/n-plus-one-api-calls-in-issue-stream")
        event["project_id"] = project.id

        settings = get_detection_settings(project.id)
        detector = NPlusOneAPICallsDetector(settings, event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"n_plus_one_api_calls_detection_rate": 0.0},
        )

        settings = get_detection_settings(project.id)
        detector = NPlusOneAPICallsDetector(settings, event)

        assert not detector.is_creation_allowed_for_project(project)

    def test_fingerprints_events(self):
        event = self.create_event(lambda i: "GET /clients/11/info")
        [problem] = self.find_problems(event)

        assert problem.fingerprint == "1-1010-e9daac10ea509a0bf84a8b8da45d36394868ad67"

    def test_fingerprints_identical_relative_urls_together(self):
        event1 = self.create_event(lambda i: "GET /clients/11/info")
        [problem1] = self.find_problems(event1)

        event2 = self.create_event(lambda i: "GET /clients/11/info")
        [problem2] = self.find_problems(event2)

        assert problem1.fingerprint == problem2.fingerprint

    def test_fingerprints_same_relative_urls_together(self):
        event1 = self.create_event(lambda i: f"GET /clients/42/info?id={i}")
        [problem1] = self.find_problems(event1)

        event2 = self.create_event(lambda i: f"GET /clients/42/info?id={i*2}")
        [problem2] = self.find_problems(event2)

        assert problem1.fingerprint == problem2.fingerprint

    def test_fingerprints_same_parameterized_integer_relative_urls_together(self):
        event1 = self.create_event(lambda i: f"GET /clients/17/info?id={i}")
        [problem1] = self.find_problems(event1)

        event2 = self.create_event(lambda i: f"GET /clients/16/info?id={i*2}")
        [problem2] = self.find_problems(event2)

        assert problem1.fingerprint == problem2.fingerprint

    def test_fingerprints_different_relative_url_separately(self):
        event1 = self.create_event(lambda i: f"GET /clients/11/info?id={i}")
        [problem1] = self.find_problems(event1)

        event2 = self.create_event(lambda i: f"GET /projects/11/details?pid={i}")
        [problem2] = self.find_problems(event2)

        assert problem1.fingerprint != problem2.fingerprint

    def test_ignores_hostname_for_fingerprinting(self):
        event1 = self.create_event(lambda i: f"GET http://service.io/clients/42/info?id={i}")
        [problem1] = self.find_problems(event1)

        event2 = self.create_event(lambda i: f"GET /clients/42/info?id={i}")
        [problem2] = self.find_problems(event2)

        assert problem1.fingerprint == problem2.fingerprint


@pytest.mark.parametrize(
    "url,parameterized_url",
    [
        (
            "",
            "",
        ),
        (
            "http://service.io",
            "http://service.io",
        ),
        (
            "https://www.service.io/resources/11",
            "https://www.service.io/resources/*",
        ),
        (
            "https://www.service.io/resources/11/details",
            "https://www.service.io/resources/*/details",
        ),
        (
            "https://www.service.io/resources/11/details?id=1&sort=down",
            "https://www.service.io/resources/*/details?id=*&sort=*",
        ),
        (
            "https://www.service.io/resources/11/details?sort=down&id=1",
            "https://www.service.io/resources/*/details?id=*&sort=*",
        ),
        (
            "https://service.io/clients/somecord/details?id=17",
            "https://service.io/clients/somecord/details?id=*",
        ),
        (
            "/clients/11/project/1343",
            "/clients/*/project/*",
        ),
        (
            "/clients/11/project/1343-turtles",
            "/clients/*/project/*",
        ),
        (
            "/clients/11/project/1343turtles",
            "/clients/*/project/1343turtles",
        ),
        (
            "/clients/563712f9722fb0996ac8f3905b40786f/project/1343",  # md5
            "/clients/*/project/*",
        ),
        (
            "/clients/563712f9722fb0996z/project/",  # md5-like
            "/clients/563712f9722fb0996z/project/",
        ),
        (
            "/clients/403926033d001b5279df37cbbe5287b7c7c267fa/project/1343",  # sha1
            "/clients/*/project/*",
        ),
        (
            "/clients/8ff81d74-606d-4c75-ac5e-cee65cbbc866/project/1343",  # uuid
            "/clients/*/project/*",
        ),
        (
            "/clients/hello-123s/project/1343",  # uuid-like
            "/clients/hello-123s/project/*",
        ),
        (
            "/item/5c9b9b609c172be2a013f534/details",  # short hash
            "/item/*/details",
        ),
        (
            "/item/be9a25322d/details",  # shorter short hash
            "/item/*/details",
        ),
        (
            "/item/defaced12/details",  # false short hash
            "/item/defaced12/details",
        ),
        (
            "/item/defaced12-abba/details",  # false short hash 2
            "/item/defaced12-abba/details",
        ),
    ],
)
def test_parameterizes_url(url, parameterized_url):
    r = NPlusOneAPICallsDetector.parameterize_url(url)
    assert r == parameterized_url


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
        {
            "span_id": "a",
            "op": "http.client",
            "hash": "b",
            "description": "GET /__nextjs_original-stack-frame?isServerSide=false&file=webpack-internal%3A%2F%2F%2F.%2Fnode_modules%2Freact-dom%2Fcjs%2Freact-dom.development.js&methodName=Object.invokeGuardedCallbackDev&arguments=&lineNumber=73&column=3`",
        },
    ],
)
def test_rejects_ineligible_spans(span):
    assert not NPlusOneAPICallsDetector.is_span_eligible(span)


@pytest.mark.parametrize(
    "url,url_without_query",
    [
        ("", ""),
        ("http://service.io", "http://service.io"),
        ("http://service.io/resource", "http://service.io/resource"),
        ("/resource?id=1", "/resource"),
        ("/resource?id=1&sort=down", "/resource"),
    ],
)
def test_removes_query_params(url, url_without_query):
    assert without_query_params(url) == url_without_query


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
