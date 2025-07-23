from __future__ import annotations

from copy import deepcopy
from typing import Any
from unittest.mock import Mock, call, patch

import pytest

from sentry.issues.grouptype import (
    PerformanceMNPlusOneDBQueriesExperimentalGroupType,
    PerformanceNPlusOneExperimentalGroupType,
)
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.options.project_option import ProjectOption
from sentry.performance_issues.base import DetectorType
from sentry.performance_issues.detectors.experiments.mn_plus_one_db_span_detector import (
    MNPlusOneDBSpanExperimentalDetector,
)
from sentry.performance_issues.performance_detection import (
    _detect_performance_problems,
    get_detection_settings,
    run_detector_on_data,
)
from sentry.performance_issues.performance_problem import PerformanceProblem
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.performance_issues.event_generators import get_event


@pytest.mark.django_db
class MNPlusOneDBDetectorTest(TestCase):
    detector = MNPlusOneDBSpanExperimentalDetector
    fingerprint_type_id = PerformanceMNPlusOneDBQueriesExperimentalGroupType.type_id
    group_type = PerformanceNPlusOneExperimentalGroupType

    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(
        self, event: dict[str, Any], settings: dict[DetectorType, Any] | None = None
    ) -> list[PerformanceProblem]:
        detector_settings = settings or self._settings
        detector = self.detector(detector_settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_parallel_m_n_plus_one(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql")

        problems = self.find_problems(event)
        assert problems == [
            PerformanceProblem(
                fingerprint=f"1-{self.fingerprint_type_id}-6807a9d5bedb6fdb175b006448cddf8cdf18fbd8",
                op="db",
                type=self.group_type,
                desc="SELECT id, name FROM authors INNER JOIN book_authors ON author_id = id WHERE book_id = $1",
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=[
                    "9c5049407f37a364",
                    "ad1453eb469473f5",
                    "9ac8fee795f25a28",
                    "aacda642ff6787c0",
                    "b231fb2367a40bb2",
                    "9abcfbac864d1b09",
                    "a4acb0c08f6c5392",
                    "a1dbea4273c7a8cf",
                    "b8467be28b0edef0",
                    "9677584719fa33f9",
                    "8c6aa95b24d15772",
                    "be7d04a1731d5d10",
                    "baa57006cb44092a",
                    "a383cd625dff4809",
                    "9c48fda36f28cb0a",
                    "82253694a3a68c93",
                    "8831cccebb865893",
                    "a2339eabb5c4cf07",
                    "8ea362c64d8b9fd9",
                    "b8f8a99b783f7b48",
                    "87a6041001b4e8f6",
                    "ab99c67643fd85cf",
                    "a96783f2f544024a",
                    "8e110c4aa54e4aa0",
                ],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": [
                        "9c5049407f37a364",
                        "ad1453eb469473f5",
                        "9ac8fee795f25a28",
                        "aacda642ff6787c0",
                        "b231fb2367a40bb2",
                        "9abcfbac864d1b09",
                        "a4acb0c08f6c5392",
                        "a1dbea4273c7a8cf",
                        "b8467be28b0edef0",
                        "9677584719fa33f9",
                        "8c6aa95b24d15772",
                        "be7d04a1731d5d10",
                        "baa57006cb44092a",
                        "a383cd625dff4809",
                        "9c48fda36f28cb0a",
                        "82253694a3a68c93",
                        "8831cccebb865893",
                        "a2339eabb5c4cf07",
                        "8ea362c64d8b9fd9",
                        "b8f8a99b783f7b48",
                        "87a6041001b4e8f6",
                        "ab99c67643fd85cf",
                        "a96783f2f544024a",
                        "8e110c4aa54e4aa0",
                    ],
                },
                evidence_display=[],
            )
        ]
        assert problems[0].title == "N+1 Query (Experimental)"

    def test_detects_prisma_client_m_n_plus_one(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-prisma-client")
        repeated_db_span_ids = [
            span["span_id"]
            for span in event["spans"]
            if span.get("description", "").startswith('SELECT "public"."reviews"."id"')
        ]
        first_db_span = next(
            span for span in event["spans"] if span["span_id"] == repeated_db_span_ids[0]
        )

        # Hardcoded first offender span, pattern span ids, and repititions
        first_offender_span_index = next(
            index
            for index, span in enumerate(event["spans"])
            if span["span_id"] == "e1c13817866a2e6f"
        )
        pattern_span_ids = [
            "e1c13817866a2e6f",
            "aa3a15d285888d70",
            "add16472abc0be2e",
            "103c3b3e339c8a0e",
            "d8b2e30697d9d493",
            "f3edcfe2e505ef57",
            "e81194ca91d594e2",
        ]
        num_pattern_repetitions = 15
        num_spans_in_pattern = len(pattern_span_ids)
        num_offender_spans = num_spans_in_pattern * num_pattern_repetitions
        # Then use that index to get all the offender spans
        offender_span_ids = [
            span["span_id"]
            for span in event["spans"][
                first_offender_span_index : (first_offender_span_index + num_offender_spans)
            ]
        ]

        problems = self.find_problems(event)
        assert len(problems) == 1
        problem = problems[0]
        assert problem == PerformanceProblem(
            fingerprint=f"1-{self.fingerprint_type_id}-44f4f3cc14f0f8d0c5ae372e5e8c80e7ba84f413",
            op="db",
            desc=first_db_span["description"],
            type=self.group_type,
            parent_span_ids=["1bb013326ff579a4"],
            cause_span_ids=repeated_db_span_ids,
            offender_span_ids=offender_span_ids,
            evidence_data={},
            evidence_display=[],
        )
        assert len(problem.offender_span_ids) == num_offender_spans
        assert problem.evidence_data == {
            "cause_span_ids": repeated_db_span_ids,
            "number_repeating_spans": str(num_offender_spans),
            "offender_span_ids": offender_span_ids,
            "op": "db",
            "parent_span": "default - render route (app) /products",
            "parent_span_ids": ["1bb013326ff579a4"],
            "repeating_spans": f'db - {first_db_span["description"]}',
            "repeating_spans_compact": first_db_span["description"],
            "transaction_name": "GET /products",
            "pattern_size": num_spans_in_pattern,
            "pattern_span_ids": pattern_span_ids,
            "num_pattern_repetitions": num_pattern_repetitions,
        }

        assert problem.evidence_display[0] == IssueEvidence(
            name="Offending Spans",
            value=f'db - {first_db_span["description"]}',
            important=True,
        )

    def test_does_not_detect_truncated_m_n_plus_one(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql-truncated")
        assert self.find_problems(event) == []

    def test_does_not_detect_n_plus_one(self):
        event = get_event("n-plus-one-in-django-index-view")
        assert self.find_problems(event) == []

    def test_does_not_detect_when_parent_is_transaction(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql-transaction-parent")
        assert self.find_problems(event) == []

    @override_options(
        {
            "performance.issues.experimental_m_n_plus_one_db_queries.problem-creation": 1.0,
        }
    )
    def test_m_n_plus_one_detector_enabled(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql")
        sdk_span_mock = Mock()
        _detect_performance_problems(event, sdk_span_mock, self.create_project())
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                # Current + Experimental Detector
                call("_pi_all_issue_count", 2),
                call("_pi_sdk_name", "sentry.javascript.node"),
                call("is_standalone_spans", False),
                call("_pi_transaction", "3818ae4f54ba4fa6ac6f68c9e32793c4"),
                # Current Detector
                call("_pi_m_n_plus_one_db_fp", "1-1011-6807a9d5bedb6fdb175b006448cddf8cdf18fbd8"),
                call("_pi_m_n_plus_one_db", "9c5049407f37a364"),
                # Experimental Detector
                call(
                    "_pi_experimental_m_n_plus_one_db_queries_fp",
                    f"1-{self.fingerprint_type_id}-6807a9d5bedb6fdb175b006448cddf8cdf18fbd8",
                ),
                call("_pi_experimental_m_n_plus_one_db_queries", "9c5049407f37a364"),
            ]
        )

    def test_m_n_plus_one_does_not_include_extra_span(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-off-by-one")
        assert self.find_problems(event) == []

    def test_m_n_plus_one_ignores_redis(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-redis")
        assert self.find_problems(event) == []

    def test_m_n_plus_one_ignores_mostly_not_db(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-mostly-http")
        assert self.find_problems(event) == []

    def test_respects_project_option(self):
        project = self.create_project()
        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql")
        event["project_id"] = project.id

        settings = get_detection_settings(project.id)
        detector = self.detector(settings, event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"n_plus_one_db_queries_detection_enabled": False},
        )

        settings = get_detection_settings(project.id)
        detector = self.detector(settings, event)

        assert not detector.is_creation_allowed_for_project(project)

    def test_respects_n_plus_one_db_duration_threshold(self):
        project = self.create_project()

        # Total duration subceeds the threshold
        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"n_plus_one_db_duration_threshold": 500},
        )

        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql")
        event["project_id"] = project.id

        settings = get_detection_settings(project_id=project.id)
        assert self.find_problems(event, settings) == []

        # Total duration exceeds the threshold
        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"n_plus_one_db_duration_threshold": 100},
        )

        settings = get_detection_settings(project_id=project.id)
        assert len(self.find_problems(event, settings)) == 1

    @patch("sentry.performance_issues.detectors.experiments.mn_plus_one_db_span_detector.metrics")
    def test_ignores_event_below_duration_threshold(self, metrics_mock):
        event = get_event("m-n-plus-one-db/m-n-plus-one-db-spans-duration-suceeds")
        assert self.find_problems(event) == []
        metrics_mock.incr.assert_called_with(
            "mn_plus_one_db_span_detector.below_duration_threshold"
        )

    @patch("sentry.performance_issues.detectors.experiments.mn_plus_one_db_span_detector.metrics")
    def test_ignores_event_with_low_db_span_percentage(self, metrics_mock):
        event = get_event("m-n-plus-one-db/m-n-plus-one-db-spans-duration-suceeds")
        for index, span in enumerate(event["spans"]):
            # Modify spans so each takes 1s, but DB spans take 1ms
            duration = 0.001 if span.get("op") == "db" else 1
            span["start_timestamp"] = index
            span["timestamp"] = index + duration
        assert self.find_problems(event) == []
        metrics_mock.incr.assert_called_with(
            "mn_plus_one_db_span_detector.below_db_span_percentage"
        )

    @patch("sentry.performance_issues.detectors.experiments.mn_plus_one_db_span_detector.metrics")
    def test_ignores_event_with_no_common_parent_span(self, metrics_mock):
        event = get_event("m-n-plus-one-db/m-n-plus-one-prisma-client")
        previous_parent_span_id = None
        for span in event["spans"]:
            # For all prisma operation spans, nest them within the previous one.
            if span.get("description") == "prisma:client:operation":
                if previous_parent_span_id:
                    span["parent_span_id"] = previous_parent_span_id
                previous_parent_span_id = span.get("span_id")

        assert self.find_problems(event) == []
        metrics_mock.incr.assert_called_with("mn_plus_one_db_span_detector.no_parent_span")

    @patch("sentry.performance_issues.detectors.experiments.mn_plus_one_db_span_detector.metrics")
    def test_ignores_prisma_client_if_depth_config_is_too_small(self, metrics_mock):
        settings = deepcopy(self._settings)
        settings[self.detector.settings_key]["max_allowable_depth"] = 1

        event = get_event("m-n-plus-one-db/m-n-plus-one-prisma-client")
        assert self.find_problems(event, settings) == []
        metrics_mock.incr.assert_called_with("mn_plus_one_db_span_detector.no_parent_span")
