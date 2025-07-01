from __future__ import annotations

from typing import Any

import pytest

from sentry.issues.grouptype import DBQueryInjectionVulnerabilityGroupType
from sentry.performance_issues.detectors.query_injection_detector import QueryInjectionDetector
from sentry.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.performance_issues.performance_problem import PerformanceProblem
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import get_event


@pytest.mark.django_db
class QueryInjectionDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = QueryInjectionDetector(self._settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_query_injection_detection_in_query_params(self):
        injection_event = get_event("query-injection/query-injection-mongo-event")

        problems = self.find_problems(injection_event)
        assert len(problems) == 1
        problem = problems[0]
        assert problem.type == DBQueryInjectionVulnerabilityGroupType
        assert problem.fingerprint == "1-1020-cc646b5cb412d3878c638d3168fd6202ba2c28e0"
        assert problem.op == "db"
        assert (
            problem.desc
            == '{"find":"?","filter":{"username":[UNTRUSTED_INPUT]},"limit":"?","singleBatch":"?","batchSize":"?"}'
        )
        assert problem.evidence_data is not None
        assert problem.evidence_data["vulnerable_parameters"] == [("username", {"$ne": None})]
        assert problem.evidence_data["request_url"] == "http://localhost:3000/login"
