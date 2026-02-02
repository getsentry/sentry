from __future__ import annotations

from typing import Any

import pytest

from sentry.issue_detection.detectors.sql_injection_detector import SQLInjectionDetector
from sentry.issue_detection.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issues.grouptype import QueryInjectionVulnerabilityGroupType
from sentry.testutils.cases import TestCase
from sentry.testutils.issue_detection.event_generators import get_event


@pytest.mark.django_db
class SQLInjectionDetectorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = SQLInjectionDetector(self._settings[SQLInjectionDetector.settings_key], event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_sql_injection_detection_in_query_params(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-event-query")

        problems = self.find_problems(injection_event)
        assert len(problems) == 1
        problem = problems[0]

        assert problem.type == QueryInjectionVulnerabilityGroupType
        assert problem.fingerprint == "1-1021-20e736601b897f6698ef6bca5082d27f5fa765e4"
        assert problem.op == "db"
        assert (
            problem.desc
            == "Untrusted Inputs [username] in `SELECT * FROM users WHERE username = %s ORDER BY username ASC`"
        )
        assert problem.evidence_data is not None
        assert problem.evidence_data["vulnerable_parameters"] == [("username", "hello")]
        assert problem.evidence_data["request_url"] == "http://localhost:3001/vulnerable-login"

    def test_sql_injection_detection_in_body(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-event-body")

        problems = self.find_problems(injection_event)
        assert len(problems) == 1
        problem = problems[0]

        assert problem.type == QueryInjectionVulnerabilityGroupType
        assert problem.fingerprint == "1-1021-da364c9819759827b8401d54783b2462683d461a"

        assert problem.op == "db"
        assert (
            problem.desc
            == "Untrusted Inputs [username] in `SELECT * FROM users WHERE username = %s`"
        )
        assert problem.evidence_data is not None
        assert problem.evidence_data["vulnerable_parameters"] == [("username", "hello")]
        assert problem.evidence_data["request_url"] == "http://localhost:3001/vulnerable-login"

    def test_sql_injection_regex(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-test-regex-event")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_not_in_where(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-not-in-where-event")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_with_comment(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-test-comment")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_on_non_vulnerable_query(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-event-non-vulnerable")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_on_laravel_query(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-laravel-query")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_on_query_with_bindings(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-query-with-bindings")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_on_event_with_excluded_package(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-event-gorm")
        assert len(self.find_problems(injection_event)) == 0

        injection_event = get_event("sql-injection/sql-injection-event-nestjs-typeorm")
        assert len(self.find_problems(injection_event)) == 0

        injection_event = get_event("sql-injection/sql-injection-event-nestjs-mikroorm")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_on_orm_queries(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-orm-event-alias-chaining")
        assert len(self.find_problems(injection_event)) == 0

        injection_event = get_event("sql-injection/sql-injection-orm-event-deleted-at-null")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_on_zf1_event(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-event-zf1")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_on_parameterized_query(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-event-parameterized-query")
        assert len(self.find_problems(injection_event)) == 0

    def test_sql_injection_on_otel_event(self) -> None:
        injection_event = get_event("sql-injection/sql-injection-event-otel")
        assert len(self.find_problems(injection_event)) == 0
