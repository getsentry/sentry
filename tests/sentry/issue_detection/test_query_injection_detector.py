from __future__ import annotations

from typing import Any

import pytest

from sentry.issue_detection.detectors.query_injection_detector import QueryInjectionDetector
from sentry.issue_detection.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issues.grouptype import QueryInjectionVulnerabilityGroupType
from sentry.testutils.cases import TestCase
from sentry.testutils.issue_detection.event_generators import get_event


@pytest.mark.django_db
class QueryInjectionDetectorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = QueryInjectionDetector(
            self._settings[QueryInjectionDetector.settings_key], event
        )
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_query_injection_detection_in_query_params(self) -> None:
        injection_event = get_event("query-injection/query-injection-mongo-event")

        problems = self.find_problems(injection_event)
        assert len(problems) == 1
        problem = problems[0]

        assert problem.type == QueryInjectionVulnerabilityGroupType
        assert problem.fingerprint == "1-1021-1c333b3c472df81fde8a61cdfae24c86676bd582"
        assert problem.op == "db"
        assert (
            problem.desc
            == 'Untrusted Inputs [username] in `{"batchSize":"?","filter":{"username":{"$ne":"?"}},"find":"users-test","limit":"?","singleBatch":"?"}`'
        )
        assert problem.evidence_data is not None
        assert problem.evidence_data["vulnerable_parameters"] == [("username", {"$ne": None})]
        assert problem.evidence_data["request_url"] == "http://localhost:3000/login"

    def test_query_injection_detection_on_sql_query(self) -> None:
        injection_event = get_event("query-injection/query-injection-sql-query")
        assert len(self.find_problems(injection_event)) == 0
