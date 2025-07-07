from __future__ import annotations

from typing import Any

import pytest

from sentry.issues.grouptype import QueryInjectionVulnerabilityGroupType
from sentry.performance_issues.detectors.sql_injection_detector import SQLInjectionDetector
from sentry.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.performance_issues.performance_problem import PerformanceProblem
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import get_event


@pytest.mark.django_db
class SQLInjectionDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = SQLInjectionDetector(self._settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_sql_injection_detection_in_query_params(self):
        injection_event = get_event("sql-injection/sql-injection-event-query")

        problems = self.find_problems(injection_event)
        assert len(problems) == 1
        problem = problems[0]

        assert problem.type == QueryInjectionVulnerabilityGroupType
        assert problem.fingerprint == "1-1020-20e736601b897f6698ef6bca5082d27f5fa765e4"
        assert problem.op == "db"
        assert (
            problem.desc
            == "Untrusted Inputs [username] in `SELECT * FROM users WHERE username = %s ORDER BY username ASC`"
        )
        assert problem.evidence_data is not None
        assert problem.evidence_data["vulnerable_parameters"] == [("username", "hello")]
        assert problem.evidence_data["request_url"] == "http://localhost:3001/vulnerable-login"

    def test_sql_injection_detection_in_body(self):
        injection_event = get_event("sql-injection/sql-injection-event-body")

        problems = self.find_problems(injection_event)
        assert len(problems) == 1
        problem = problems[0]

        assert problem.type == QueryInjectionVulnerabilityGroupType
        assert problem.fingerprint == "1-1020-da364c9819759827b8401d54783b2462683d461a"

        assert problem.op == "db"
        assert (
            problem.desc
            == "Untrusted Inputs [username] in `SELECT * FROM users WHERE username = %s`"
        )
        assert problem.evidence_data is not None
        assert problem.evidence_data["vulnerable_parameters"] == [("username", "hello")]
        assert problem.evidence_data["request_url"] == "http://localhost:3001/vulnerable-login"

    def test_sql_injection_regex(self):
        injection_event = get_event("sql-injection/sql-injection-test-regex-event")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_not_in_where(self):
        injection_event = get_event("sql-injection/sql-injection-not-in-where-event")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_on_non_vulnerable_query(self):
        injection_event = get_event("sql-injection/sql-injection-event-non-vulnerable")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_on_invalid_package(self):
        injection_event = get_event("sql-injection/sql-injection-event-invalid-package")
        assert len(self.find_problems(injection_event)) == 0
