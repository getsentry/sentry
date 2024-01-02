from __future__ import annotations

from typing import Any
from unittest.mock import Mock, call

import pytest

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.detectors.mn_plus_one_db_span_detector import (
    MNPlusOneDBSpanDetector,
)
from sentry.utils.performance_issues.performance_detection import (
    _detect_performance_problems,
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


@region_silo_test
@pytest.mark.django_db
class MNPlusOneDBDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = MNPlusOneDBSpanDetector(self._settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_parallel_m_n_plus_one(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql")

        problems = self.find_problems(event)
        assert problems == [
            PerformanceProblem(
                fingerprint="1-1011-6807a9d5bedb6fdb175b006448cddf8cdf18fbd8",
                op="db",
                type=PerformanceNPlusOneGroupType,
                desc="SELECT id, name FROM authors INNER JOIN book_authors ON author_id = id WHERE book_id = $1",
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=[
                    "9c5049407f37a364",
                    "ad1453eb469473f5",
                    "9ac8fee795f25a28",
                    "aacda642ff6787c0",
                    "b231fb2367a40bb2",
                    "9abcfbac864d1b09",
                    "a4acb0c08f6c5392",
                    "a1dbea4273c7a8cf",
                    "b8467be28b0edef0",
                    "9677584719fa33f9",
                    "8c6aa95b24d15772",
                    "be7d04a1731d5d10",
                    "baa57006cb44092a",
                    "a383cd625dff4809",
                    "9c48fda36f28cb0a",
                    "82253694a3a68c93",
                    "8831cccebb865893",
                    "a2339eabb5c4cf07",
                    "8ea362c64d8b9fd9",
                    "b8f8a99b783f7b48",
                    "87a6041001b4e8f6",
                    "ab99c67643fd85cf",
                    "a96783f2f544024a",
                    "8e110c4aa54e4aa0",
                ],
                evidence_data={
                    "op": "db",
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": [
                        "9c5049407f37a364",
                        "ad1453eb469473f5",
                        "9ac8fee795f25a28",
                        "aacda642ff6787c0",
                        "b231fb2367a40bb2",
                        "9abcfbac864d1b09",
                        "a4acb0c08f6c5392",
                        "a1dbea4273c7a8cf",
                        "b8467be28b0edef0",
                        "9677584719fa33f9",
                        "8c6aa95b24d15772",
                        "be7d04a1731d5d10",
                        "baa57006cb44092a",
                        "a383cd625dff4809",
                        "9c48fda36f28cb0a",
                        "82253694a3a68c93",
                        "8831cccebb865893",
                        "a2339eabb5c4cf07",
                        "8ea362c64d8b9fd9",
                        "b8f8a99b783f7b48",
                        "87a6041001b4e8f6",
                        "ab99c67643fd85cf",
                        "a96783f2f544024a",
                        "8e110c4aa54e4aa0",
                    ],
                },
                evidence_display=[],
            )
        ]
        assert problems[0].title == "N+1 Query"

    def test_does_not_detect_truncated_m_n_plus_one(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql-truncated")
        assert self.find_problems(event) == []

    def test_does_not_detect_n_plus_one(self):
        event = get_event("n-plus-one-in-django-index-view")
        assert self.find_problems(event) == []

    def test_does_not_detect_when_parent_is_transaction(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql-transaction-parent")
        assert self.find_problems(event) == []

    def test_m_n_plus_one_detector_enabled(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql")
        sdk_span_mock = Mock()
        _detect_performance_problems(event, sdk_span_mock, self.create_project())
        sdk_span_mock.containing_transaction.set_tag.assert_has_calls(
            [
                call("_pi_all_issue_count", 1),
                call("_pi_sdk_name", "sentry.javascript.node"),
                call("_pi_transaction", "3818ae4f54ba4fa6ac6f68c9e32793c4"),
                call(
                    "_pi_m_n_plus_one_db_fp",
                    "1-1011-6807a9d5bedb6fdb175b006448cddf8cdf18fbd8",
                ),
                call("_pi_m_n_plus_one_db", "9c5049407f37a364"),
            ]
        )

    def test_m_n_plus_one_does_not_include_extra_span(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-off-by-one")
        assert self.find_problems(event) == []

    def test_m_n_plus_one_ignores_redis(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-redis")
        assert self.find_problems(event) == []

    def test_m_n_plus_one_ignores_mostly_not_db(self):
        event = get_event("m-n-plus-one-db/m-n-plus-one-mostly-http")
        assert self.find_problems(event) == []

    def test_respects_project_option(self):
        project = self.create_project()
        event = get_event("m-n-plus-one-db/m-n-plus-one-graphql")
        event["project_id"] = project.id

        settings = get_detection_settings(project.id)
        detector = MNPlusOneDBSpanDetector(settings, event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"n_plus_one_db_queries_detection_enabled": False},
        )

        settings = get_detection_settings(project.id)
        detector = MNPlusOneDBSpanDetector(settings, event)

        assert not detector.is_creation_allowed_for_project(project)
