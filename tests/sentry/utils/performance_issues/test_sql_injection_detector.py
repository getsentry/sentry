from __future__ import annotations

from typing import Any

import pytest

from sentry.issues.grouptype import DBInjectionVulnerabilityGroupType
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.utils.performance_issues.detectors.sql_injection_detector import SQLInjectionDetector
from sentry.utils.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


@pytest.mark.django_db
class SQLInjectionDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = SQLInjectionDetector(self._settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_sql_injection_detection(self):
        injection_event = get_event("sql-injection/sql-injection-event")

        problems = self.find_problems(injection_event)
        assert len(problems) == 1
        problem = problems[0]
        assert problem.type == DBInjectionVulnerabilityGroupType
        assert problem.fingerprint == "1-1020-6333ad81b9a8694d7e4a3608a313aae851b024d4"
        assert problem.op == "db"
        assert problem.desc == "SELECT * FROM users WHERE username = 'hello'"
        assert problem.cause_span_ids == []
        assert problem.parent_span_ids == []

    def test_sql_injection_on_non_vulnerable_query(self):
        injection_event = get_event("sql-injection/sql-injection-event-non-vulnerable")
        assert len(self.find_problems(injection_event)) == 0
