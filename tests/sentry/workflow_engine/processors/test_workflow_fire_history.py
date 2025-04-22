from datetime import timedelta
from uuid import uuid4

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.endpoints.serializers import WorkflowGroupHistory
from sentry.workflow_engine.models import WorkflowFireHistory
from sentry.workflow_engine.processors.workflow_fire_history import fetch_workflow_groups_paginated

pytestmark = [requires_snuba]


@freeze_time()
class WorkflowFireHistoryProcessorTest(TestCase):
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
