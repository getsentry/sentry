from __future__ import annotations

from typing import Any

import pytest

from sentry.issues.grouptype import DBQueryInjectionVulnerabilityGroupType
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.utils.performance_issues.detectors.query_injection_detector import (
    QueryInjectionDetector,
)
from sentry.utils.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


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
        assert problem.fingerprint == "1-1020-e61fdbeae20c9e03e973dc96a0b25175844e142b"
        assert problem.op == "db"
        assert (
            problem.desc
            == '{"find":"?","filter":{"?":{"$ne":"?"}},"limit":"?","singleBatch":"?","batchSize":"?"}'
        )
        assert problem.evidence_data is not None
        assert problem.evidence_data["unsafe_inputs"] == ["username"]
        assert problem.evidence_data["request_url"] == "http://localhost:3000/login"
