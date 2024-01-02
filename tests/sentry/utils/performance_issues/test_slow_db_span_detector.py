from __future__ import annotations

from typing import Any

import pytest

from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import (
    create_event,
    create_span,
    get_event,
)
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.detectors.slow_db_query_detector import SlowDBQueryDetector
from sentry.utils.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


@region_silo_test
@pytest.mark.django_db
class SlowDBQueryDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = SlowDBQueryDetector(self._settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_calls_detect_slow_span(self):
        no_slow_span_event = create_event([create_span("db", 499.0)] * 1)
        slow_not_allowed_op_span_event = create_event([create_span("random", 1001.0, "example")])
        slow_span_event = create_event([create_span("db", 1001.0)] * 1)

        assert self.find_problems(no_slow_span_event) == []
        assert self.find_problems(slow_not_allowed_op_span_event) == []
        assert self.find_problems(slow_span_event) == [
            PerformanceProblem(
                fingerprint="1-1001-da39a3ee5e6b4b0d3255bfef95601890afd80709",
                op="db",
                desc="SELECT count() FROM table WHERE id = %s",
                type=PerformanceSlowDBQueryGroupType,
                parent_span_ids=None,
                cause_span_ids=None,
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": None,
                    "cause_span_ids": None,
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
            )
        ]

    def test_skip_queries_without_select(self):
        event = create_event([create_span("db", 100000.0, "DELETE FROM table WHERE id = %s")] * 1)
        assert self.find_problems(event) == []

    def test_calls_slow_span_threshold(self):
        http_span_event = create_event(
            [create_span("http.client", 1001.0, "http://example.com")] * 1
        )
        db_span_event = create_event([create_span("db.query", 1001.0)] * 1)

        assert self.find_problems(http_span_event) == []
        assert self.find_problems(db_span_event) == [
            PerformanceProblem(
                fingerprint="1-1001-da39a3ee5e6b4b0d3255bfef95601890afd80709",
                op="db.query",
                desc="SELECT count() FROM table WHERE id = %s",
                type=PerformanceSlowDBQueryGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "db.query",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
            )
        ]

    def test_detects_slow_span_in_solved_n_plus_one_query(self):
        n_plus_one_event = get_event("solved-n-plus-one-in-django-index-view")

        assert self.find_problems(n_plus_one_event) == [
            PerformanceProblem(
                fingerprint="1-1001-d02c8b2fd92a2d72011671feda429fa8ce2ac00f",
                op="db",
                desc="\n                SELECT VERSION(),\n                       @@sql_mode,\n                       @@default_storage_engine,\n                       @@sql_auto_is_null,\n                       @@lower_case_table_names,\n                       CONVERT_TZ('2001-01-01 01:00:00', 'UTC', 'UTC') IS NOT NULL\n            ",
                type=PerformanceSlowDBQueryGroupType,
                parent_span_ids=None,
                cause_span_ids=None,
                offender_span_ids=["a05754d3fde2db29"],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": None,
                    "cause_span_ids": None,
                    "offender_span_ids": ["a05754d3fde2db29"],
                },
                evidence_display=[],
            )
        ]

    def test_skips_truncated_queries(self):
        slow_span_event_with_truncated_query = create_event(
            [create_span("db", 1005, "SELECT `product`.`id` FROM `products` ...")] * 1
        )
        slow_span_event = create_event(
            [create_span("db", 1005, "SELECT `product`.`id` FROM `products`")] * 1
        )

        assert self.find_problems(slow_span_event_with_truncated_query) == []
        assert self.find_problems(slow_span_event) == [
            PerformanceProblem(
                fingerprint="1-1001-da39a3ee5e6b4b0d3255bfef95601890afd80709",
                op="db",
                desc="SELECT `product`.`id` FROM `products`",
                type=PerformanceSlowDBQueryGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["bbbbbbbbbbbbbbbb"],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": ["bbbbbbbbbbbbbbbb"],
                },
                evidence_display=[],
            )
        ]

    def test_respects_feature_flag(self):
        project = self.create_project()
        slow_span_event = create_event(
            [create_span("db", 1005, "SELECT `product`.`id` FROM `products`")] * 1
        )

        detector = SlowDBQueryDetector(self._settings, slow_span_event)

        assert not detector.is_creation_allowed_for_organization(project.organization)

        with self.feature({"organizations:performance-slow-db-issue": True}):
            assert detector.is_creation_allowed_for_organization(project.organization)

    def test_respects_project_option(self):
        project = self.create_project()
        slow_span_event = create_event(
            [create_span("db", 1005, "SELECT `product`.`id` FROM `products`")] * 1
        )
        slow_span_event["project_id"] = project.id

        settings = get_detection_settings(project.id)
        detector = SlowDBQueryDetector(settings, slow_span_event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"slow_db_queries_detection_enabled": False},
        )

        settings = get_detection_settings(project.id)
        detector = SlowDBQueryDetector(settings, slow_span_event)

        assert not detector.is_creation_allowed_for_project(project)
