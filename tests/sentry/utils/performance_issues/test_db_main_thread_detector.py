from typing import List

import pytest

from sentry.eventstore.models import Event
from sentry.issues.grouptype import PerformanceDBMainThreadGroupType
from sentry.testutils import TestCase
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.detectors import DBMainThreadDetector
from sentry.utils.performance_issues.performance_detection import (
    PerformanceProblem,
    get_detection_settings,
    run_detector_on_data,
)


@region_silo_test
@pytest.mark.django_db
class DBMainThreadDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def find_problems(self, event: Event) -> List[PerformanceProblem]:
        detector = DBMainThreadDetector(self.settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_db_main_thread(self):
        event = get_event("db-on-main-thread")

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

    def test_does_not_detect_db_main_thread(self):
        event = get_event("db-on-main-thread")
        event["spans"][0]["data"]["blocked_main_thread"] = False

        assert self.find_problems(event) == []

    def test_gives_problem_correct_title(self):
        event = get_event("db-on-main-thread")
        event["spans"][0]["data"]["blocked_main_thread"] = True
        problem = self.find_problems(event)[0]
        assert problem.title == "DB on Main Thread"

    def test_duplicate_calls_do_not_change_callstack(self):
        event = get_event("db-on-main-thread")
        event["spans"][0]["data"]["blocked_main_thread"] = True
        single_span_problem = self.find_problems(event)[0]
        single_problem_fingerprint = single_span_problem.fingerprint
        event["spans"].append(event["spans"][0])
        double_span_problem = self.find_problems(event)[0]
        assert double_span_problem.title == "DB on Main Thread"
        assert double_span_problem.fingerprint == single_problem_fingerprint
