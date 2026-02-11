from __future__ import annotations

from typing import Any

import pytest

from sentry.issue_detection.detectors.io_main_thread_detector import DBMainThreadDetector
from sentry.issue_detection.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issues.grouptype import PerformanceDBMainThreadGroupType
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.testutils.issue_detection.event_generators import get_event


@pytest.mark.django_db
class DBMainThreadDetectorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = DBMainThreadDetector(self._settings[DBMainThreadDetector.settings_key], event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_db_main_thread(self) -> None:
        event = get_event("db-on-main-thread/db-on-main-thread")

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint=f"1-{PerformanceDBMainThreadGroupType.type_id}-86f1961bdc10a14809866c6a6ec0033797123ba9",
                op="db",
                desc="SELECT * FROM my_cool_database WHERE some_col=some_val",
                type=PerformanceDBMainThreadGroupType,
                parent_span_ids=["b93d2be92cd64fd5"],
                cause_span_ids=[],
                offender_span_ids=["054ba3a374d543eb"],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": ["b93d2be92cd64fd5"],
                    "cause_span_ids": [],
                    "offender_span_ids": ["054ba3a374d543eb"],
                },
                evidence_display=[],
            )
        ]

    def test_respects_project_option(self) -> None:
        project = self.create_project()
        event = get_event("db-on-main-thread/db-on-main-thread")
        event["project_id"] = project.id

        settings = get_detection_settings(project.id)
        detector = DBMainThreadDetector(settings[DBMainThreadDetector.settings_key], event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"db_on_main_thread_detection_enabled": False},
        )

        settings = get_detection_settings(project.id)
        detector = DBMainThreadDetector(settings[DBMainThreadDetector.settings_key], event)

        assert not detector.is_creation_allowed_for_project(project)

    def test_does_not_detect_db_main_thread(self) -> None:
        event = get_event("db-on-main-thread/db-on-main-thread")
        event["spans"][0]["data"]["blocked_main_thread"] = False

        assert self.find_problems(event) == []

    def test_gives_problem_correct_title(self) -> None:
        event = get_event("db-on-main-thread/db-on-main-thread")
        event["spans"][0]["data"]["blocked_main_thread"] = True
        problem = self.find_problems(event)[0]
        assert problem.title == "DB on Main Thread"

    def test_duplicate_calls_do_not_change_callstack(self) -> None:
        event = get_event("db-on-main-thread/db-on-main-thread")
        event["spans"][0]["data"]["blocked_main_thread"] = True
        single_span_problem = self.find_problems(event)[0]
        single_problem_fingerprint = single_span_problem.fingerprint
        event["spans"].append(event["spans"][0])
        double_span_problem = self.find_problems(event)[0]
        assert double_span_problem.title == "DB on Main Thread"
        assert double_span_problem.fingerprint == single_problem_fingerprint
