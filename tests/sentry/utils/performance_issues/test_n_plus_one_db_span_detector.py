from __future__ import annotations

import unittest
from typing import Any

import pytest

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.base import DetectorType
from sentry.utils.performance_issues.detectors.n_plus_one_db_span_detector import (
    NPlusOneDBSpanDetector,
)
from sentry.utils.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


@region_silo_test
@pytest.mark.django_db
class NPlusOneDbDetectorTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(
        self, event: dict[str, Any], setting_overides: dict[str, Any] | None = None
    ) -> list[PerformanceProblem]:
        if setting_overides:
            for option_name, value in setting_overides.items():
                self._settings[DetectorType.N_PLUS_ONE_DB_QUERIES][option_name] = value

        detector = NPlusOneDBSpanDetector(self._settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_does_not_detect_issues_in_fast_transaction(self):
        event = get_event("no-issue-in-django-detail-view")
        assert self.find_problems(event) == []

    def test_detects_n_plus_one_with_unparameterized_query(
        self,
    ):
        event = get_event("n-plus-one-in-django-index-view-unparameterized")
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-8d86357da4d8a866b19c97670edee38d037a7bc8",
                op="db",
                desc="SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = 1 LIMIT 21",
                type=PerformanceNPlusOneGroupType,
                parent_span_ids=["8dd7a5869a4f4583"],
                cause_span_ids=["9179e43ae844b174"],
                offender_span_ids=[
                    "b8be6138369491dd",
                    "b2d4826e7b618f1b",
                    "b3fdeea42536dbf1",
                    "b409e78a092e642f",
                    "86d2ede57bbf48d4",
                    "8e554c84cdc9731e",
                    "94d6230f3f910e12",
                    "a210b87a2191ceb6",
                    "88a5ccaf25b9bd8f",
                    "bb32cf50fc56b296",
                ],
                evidence_data={
                    "transaction_name": "/books/",
                    "op": "db",
                    "parent_span_ids": ["8dd7a5869a4f4583"],
                    "parent_span": "django.view - index",
                    "cause_span_ids": ["9179e43ae844b174"],
                    "offender_span_ids": [
                        "b8be6138369491dd",
                        "b2d4826e7b618f1b",
                        "b3fdeea42536dbf1",
                        "b409e78a092e642f",
                        "86d2ede57bbf48d4",
                        "8e554c84cdc9731e",
                        "94d6230f3f910e12",
                        "a210b87a2191ceb6",
                        "88a5ccaf25b9bd8f",
                        "bb32cf50fc56b296",
                    ],
                    "repeating_spans": "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = 1 LIMIT 21",
                    "repeating_spans_compact": "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = 1 LIMIT 21",
                    "num_repeating_spans": "10",
                },
                evidence_display=[
                    IssueEvidence(
                        name="Offending Spans",
                        value="db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = 1 LIMIT 21",
                        important=True,
                    )
                ],
            )
        ]

    def test_does_not_detect_n_plus_one_with_source_redis_query_with_noredis_detector(
        self,
    ):
        event = get_event("n-plus-one-in-django-index-view-source-redis")
        assert self.find_problems(event) == []

    def test_does_not_detect_n_plus_one_with_repeating_redis_query_with_noredis_detector(
        self,
    ):
        event = get_event("n-plus-one-in-django-index-view-repeating-redis")
        assert self.find_problems(event) == []

    def test_ignores_fast_n_plus_one(self):
        event = get_event("fast-n-plus-one-in-django-new-view")
        assert self.find_problems(event) == []

    def test_detects_slow_span_but_not_n_plus_one_in_query_waterfall(self):
        event = get_event("query-waterfall-in-django-random-view")
        assert self.find_problems(event) == []

    def test_finds_n_plus_one_with_db_dot_something_spans(self):
        event = get_event("n-plus-one-in-django-index-view-activerecord")
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-8d86357da4d8a866b19c97670edee38d037a7bc8",
                op="db",
                desc="SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                type=PerformanceNPlusOneGroupType,
                parent_span_ids=["8dd7a5869a4f4583"],
                cause_span_ids=["9179e43ae844b174"],
                offender_span_ids=[
                    "b8be6138369491dd",
                    "b2d4826e7b618f1b",
                    "b3fdeea42536dbf1",
                    "b409e78a092e642f",
                    "86d2ede57bbf48d4",
                    "8e554c84cdc9731e",
                    "94d6230f3f910e12",
                    "a210b87a2191ceb6",
                    "88a5ccaf25b9bd8f",
                    "bb32cf50fc56b296",
                ],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": ["8dd7a5869a4f4583"],
                    "cause_span_ids": ["9179e43ae844b174"],
                    "offender_span_ids": [
                        "b8be6138369491dd",
                        "b2d4826e7b618f1b",
                        "b3fdeea42536dbf1",
                        "b409e78a092e642f",
                        "86d2ede57bbf48d4",
                        "8e554c84cdc9731e",
                        "94d6230f3f910e12",
                        "a210b87a2191ceb6",
                        "88a5ccaf25b9bd8f",
                        "bb32cf50fc56b296",
                    ],
                },
                evidence_display=[],
            )
        ]

    def test_n_plus_one_db_detector_has_different_fingerprints_for_different_n_plus_one_events(
        self,
    ):
        index_n_plus_one_event = get_event("n-plus-one-in-django-index-view")
        new_n_plus_one_event = get_event("n-plus-one-in-django-new-view")

        index_problems = self.find_problems(index_n_plus_one_event)
        new_problems = self.find_problems(new_n_plus_one_event)

        index_fingerprint = index_problems[0].fingerprint
        new_fingerprint = new_problems[0].fingerprint

        assert index_fingerprint
        assert new_fingerprint
        assert index_fingerprint != new_fingerprint

    def test_detects_n_plus_one_with_multiple_potential_sources(self):
        event = get_event("n-plus-one-in-django-with-odd-db-sources")

        assert self.find_problems(event, {"duration_threshold": 0}) == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-e55ea09e1cff0ca2369f287cf624700f98cf4b50",
                op="db",
                type=PerformanceNPlusOneGroupType,
                desc='SELECT "expense_expenses"."id", "expense_expenses"."report_id", "expense_expenses"."amount" FROM "expense_expenses" WHERE "expense_expenses"."report_id" = %s',
                parent_span_ids=["81a4b462bdc5c764"],
                cause_span_ids=["99797d06e2fa9750"],
                offender_span_ids=[
                    "9c7876a6d7a26c72",
                    "b31f67541d38ad0c",
                    "aff9d1545b41f1de",
                    "86a56025d94edb85",
                    "b5e340041cfc2532",
                    "b77a0b154e782baa",
                    "9c46a977962d6ed1",
                    "b03da8752eeddebe",
                    "8c173716d4c7e41b",
                    "b4e6f90c66e90238",
                    "987affc4f2faa24b",
                    "b7d323b4f5f8b2b0",
                    "a4f0a57410b61072",
                    "a6120e2d88c86ea4",
                    "a87019f03438311e",
                    "b5487ad7228cfd6e",
                    "bc44d59a63a4115c",
                    "84b05df439e4a6ee",
                    "be85dffe4a9a3120",
                    "a3c381b1952dd7fb",
                ],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": ["81a4b462bdc5c764"],
                    "cause_span_ids": ["99797d06e2fa9750"],
                    "offender_span_ids": [
                        "9c7876a6d7a26c72",
                        "b31f67541d38ad0c",
                        "aff9d1545b41f1de",
                        "86a56025d94edb85",
                        "b5e340041cfc2532",
                        "b77a0b154e782baa",
                        "9c46a977962d6ed1",
                        "b03da8752eeddebe",
                        "8c173716d4c7e41b",
                        "b4e6f90c66e90238",
                        "987affc4f2faa24b",
                        "b7d323b4f5f8b2b0",
                        "a4f0a57410b61072",
                        "a6120e2d88c86ea4",
                        "a87019f03438311e",
                        "b5487ad7228cfd6e",
                        "bc44d59a63a4115c",
                        "84b05df439e4a6ee",
                        "be85dffe4a9a3120",
                        "a3c381b1952dd7fb",
                    ],
                },
                evidence_display=[],
            ),
        ]

    def test_detects_overlapping_n_plus_one(self):
        event = get_event("parallel-n-plus-one-in-django-index-view")
        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint="1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-8d86357da4d8a866b19c97670edee38d037a7bc8",
                op="db",
                desc="SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                type=PerformanceNPlusOneGroupType,
                parent_span_ids=["8dd7a5869a4f4583"],
                cause_span_ids=["9179e43ae844b174"],
                offender_span_ids=[
                    "b8be6138369491dd",
                    "b2d4826e7b618f1b",
                    "b3fdeea42536dbf1",
                    "b409e78a092e642f",
                    "86d2ede57bbf48d4",
                    "8e554c84cdc9731e",
                    "94d6230f3f910e12",
                    "a210b87a2191ceb6",
                    "88a5ccaf25b9bd8f",
                    "bb32cf50fc56b296",
                ],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": ["8dd7a5869a4f4583"],
                    "cause_span_ids": ["9179e43ae844b174"],
                    "offender_span_ids": [
                        "b8be6138369491dd",
                        "b2d4826e7b618f1b",
                        "b3fdeea42536dbf1",
                        "b409e78a092e642f",
                        "86d2ede57bbf48d4",
                        "8e554c84cdc9731e",
                        "94d6230f3f910e12",
                        "a210b87a2191ceb6",
                        "88a5ccaf25b9bd8f",
                        "bb32cf50fc56b296",
                    ],
                },
                evidence_display=[],
            )
        ]


@pytest.mark.django_db
class NPlusOneDbSettingTest(TestCase):
    def test_respects_project_option(self):
        project = self.create_project()
        event = get_event("n-plus-one-in-django-index-view-activerecord")
        event["project_id"] = project.id

        settings = get_detection_settings(project.id)
        detector = NPlusOneDBSpanDetector(settings, event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"n_plus_one_db_queries_detection_enabled": False},
        )

        settings = get_detection_settings(project.id)
        detector = NPlusOneDBSpanDetector(settings, event)

        assert not detector.is_creation_allowed_for_project(project)
