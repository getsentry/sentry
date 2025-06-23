from datetime import timedelta
from uuid import uuid4

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.endpoints.serializers import WorkflowGroupHistory
from sentry.workflow_engine.models import Action, WorkflowFireHistory
from sentry.workflow_engine.processors.workflow_fire_history import (
    create_workflow_fire_histories,
    fetch_workflow_groups_paginated,
    fetch_workflow_hourly_stats,
)
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


@freeze_time()
class WorkflowGroupsPaginatedTest(TestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group()
        self.project = self.group.project
        self.organization = self.project.organization

        self.history: list[WorkflowFireHistory] = []
        self.workflow = self.create_workflow(organization=self.organization)
        for i in range(3):
            self.history.append(
                WorkflowFireHistory(workflow=self.workflow, group=self.group, event_id=uuid4().hex)
            )
        self.group_2 = self.create_group()
        self.history.append(
            WorkflowFireHistory(workflow=self.workflow, group=self.group_2, event_id=uuid4().hex)
        )
        self.group_3 = self.create_group()
        for i in range(2):
            self.history.append(
                WorkflowFireHistory(
                    workflow=self.workflow,
                    group=self.group_3,
                    event_id=uuid4().hex,
                )
            )
        self.workflow_2 = self.create_workflow(organization=self.organization)
        self.history.append(
            WorkflowFireHistory(workflow=self.workflow_2, group=self.group, event_id=uuid4().hex)
        )

        histories: list[WorkflowFireHistory] = WorkflowFireHistory.objects.bulk_create(self.history)

        # manually update date_added
        for i in range(3):
            histories[i].update(date_added=before_now(days=i + 1))
        histories[3].update(date_added=before_now(days=1))
        for i in range(2):
            histories[i + 4].update(date_added=before_now(days=i + 1))
        histories[-1].update(date_added=before_now(days=0))

        self.base_triggered_date = before_now(days=1)

        self.login_as(self.user)

    def assert_expected_results(
        self, workflow, start, end, expected_results, cursor=None, per_page=25
    ):
        result = fetch_workflow_groups_paginated(workflow, start, end, cursor, per_page)
        assert result.results == expected_results, (result.results, expected_results)
        return result

    def test_workflow_groups_paginated__simple(self):
        self.assert_expected_results(
            workflow=self.workflow,
            start=before_now(days=6),
            end=before_now(days=0),
            expected_results=[
                WorkflowGroupHistory(
                    self.group,
                    count=3,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[0].event_id,
                ),
                WorkflowGroupHistory(
                    self.group_3,
                    count=2,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[4].event_id,
                ),
                WorkflowGroupHistory(
                    self.group_2,
                    count=1,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[3].event_id,
                ),
            ],
        )

    def test_workflow_groups_paginated__cursor(self):
        result = self.assert_expected_results(
            workflow=self.workflow,
            start=before_now(days=6),
            end=before_now(days=0),
            expected_results=[
                WorkflowGroupHistory(
                    self.group,
                    count=3,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[0].event_id,
                ),
            ],
            per_page=1,
        )
        # use the cursor to get the next page
        result = self.assert_expected_results(
            workflow=self.workflow,
            start=before_now(days=6),
            end=before_now(days=0),
            expected_results=[
                WorkflowGroupHistory(
                    self.group_3,
                    count=2,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[4].event_id,
                ),
            ],
            cursor=result.next,
            per_page=1,
        )
        # get the next page
        self.assert_expected_results(
            workflow=self.workflow,
            start=before_now(days=6),
            end=before_now(days=0),
            expected_results=[
                WorkflowGroupHistory(
                    self.group_2,
                    count=1,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[3].event_id,
                ),
            ],
            cursor=result.next,
            per_page=1,
        )

    def test_workflow_groups_paginated__filters_counts(self):
        # Test that the count is updated if the date range affects it
        self.assert_expected_results(
            workflow=self.workflow,
            start=before_now(days=1),
            end=before_now(days=0),
            expected_results=[
                WorkflowGroupHistory(
                    self.group,
                    count=1,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[0].event_id,
                ),
                WorkflowGroupHistory(
                    self.group_2,
                    count=1,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[3].event_id,
                ),
                WorkflowGroupHistory(
                    self.group_3,
                    count=1,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[4].event_id,
                ),
            ],
        )

    def test_workflow_groups_paginated__past_date_range(self):
        self.assert_expected_results(
            workflow=self.workflow,
            start=before_now(days=3),
            end=before_now(days=2),
            expected_results=[
                WorkflowGroupHistory(
                    self.group,
                    count=1,
                    last_triggered=self.base_triggered_date - timedelta(days=2),
                    event_id=self.history[2].event_id,
                ),
            ],
        )


@freeze_time()
class WorkflowHourlyStatsTest(TestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group()
        self.project = self.group.project
        self.organization = self.project.organization

        self.history: list[WorkflowFireHistory] = []
        self.workflow = self.create_workflow(organization=self.organization)

        for i in range(3):
            for _ in range(i + 1):
                self.history.append(
                    WorkflowFireHistory(
                        workflow=self.workflow,
                        group=self.group,
                    )
                )

        self.workflow_2 = self.create_workflow(organization=self.organization)
        for i in range(2):
            self.history.append(
                WorkflowFireHistory(
                    workflow=self.workflow_2,
                    group=self.group,
                )
            )

        histories: list[WorkflowFireHistory] = WorkflowFireHistory.objects.bulk_create(self.history)

        # manually update date_added
        index = 0
        for i in range(3):
            for _ in range(i + 1):
                histories[index].update(date_added=before_now(hours=i + 1))
                index += 1

        for i in range(2):
            histories[i + 6].update(date_added=before_now(hours=i + 4))

        self.base_triggered_date = before_now(days=1)

        self.login_as(self.user)

    def test_workflow_hourly_stats(self):
        results = fetch_workflow_hourly_stats(self.workflow, before_now(hours=6), before_now())
        assert len(results) == 6
        assert [result.count for result in results] == [
            0,
            0,
            3,
            2,
            1,
            0,
        ]  # last zero is for the current hour

    def test_workflow_hourly_stats__past_date_range(self):
        results = fetch_workflow_hourly_stats(
            self.workflow_2, before_now(hours=6), before_now(hours=2)
        )
        assert len(results) == 4
        assert [result.count for result in results] == [1, 1, 0, 0]


class TestWorkflowFireHistory(BaseWorkflowTest):
    def setUp(self):
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        self.action_group, self.action = self.create_workflow_action(workflow=self.workflow)

        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        )
        self.event_data = WorkflowEventData(event=self.group_event)

    def test_create_workflow_fire_histories(self):
        create_workflow_fire_histories(
            self.detector, Action.objects.filter(id=self.action.id), self.event_data
        )
        assert (
            WorkflowFireHistory.objects.filter(
                detector=self.detector,
                workflow=self.workflow,
                group=self.group,
                event_id=self.group_event.event_id,
            ).count()
            == 1
        )
