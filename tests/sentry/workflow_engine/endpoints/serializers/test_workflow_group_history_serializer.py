from datetime import datetime, timedelta
from uuid import uuid4

from sentry.incidents.grouptype import MetricIssue
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.utils.cursors import Cursor, CursorResult
from sentry.workflow_engine.endpoints.serializers.workflow_group_history_serializer import (
    WorkflowGroupHistory,
    fetch_workflow_groups_paginated,
)
from sentry.workflow_engine.models import DetectorGroup, Workflow, WorkflowFireHistory

pytestmark = [requires_snuba]


@freeze_time()
class WorkflowGroupsPaginatedTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group()
        self.project = self.group.project
        self.organization = self.project.organization

        self.history: list[WorkflowFireHistory] = []
        self.workflow = self.create_workflow(organization=self.organization)

        self.detector_1 = self.create_detector(
            project_id=self.project.id,
            type=MetricIssue.slug,
        )
        DetectorGroup.objects.create(
            detector=self.detector_1,
            group=self.group,
        )
        for i in range(3):
            self.history.append(
                WorkflowFireHistory(
                    detector=self.detector_1,
                    workflow=self.workflow,
                    group=self.group,
                    event_id=uuid4().hex,
                )
            )
        self.group_2 = self.create_group()
        self.detector_2 = self.create_detector(
            project_id=self.project.id,
            type=MetricIssue.slug,
        )
        DetectorGroup.objects.create(
            detector=self.detector_2,
            group=self.group_2,
        )
        self.history.append(
            WorkflowFireHistory(
                detector=self.detector_2,
                workflow=self.workflow,
                group=self.group_2,
                event_id=uuid4().hex,
            )
        )
        self.group_3 = self.create_group()
        self.detector_3 = self.create_detector(
            project_id=self.project.id,
            type=MetricIssue.slug,
        )
        DetectorGroup.objects.create(
            detector=self.detector_3,
            group=self.group_3,
        )
        for i in range(2):
            self.history.append(
                WorkflowFireHistory(
                    detector=self.detector_3,
                    workflow=self.workflow,
                    group=self.group_3,
                    event_id=uuid4().hex,
                )
            )
        # this will be ordered after the WFH with self.detector_1
        self.detector_4 = self.create_detector(
            project_id=self.project.id,
            type=MetricIssue.slug,
        )
        self.workflow_2 = self.create_workflow(organization=self.organization)
        self.history.append(
            WorkflowFireHistory(
                detector=self.detector_4,
                workflow=self.workflow_2,
                group=self.group,
                event_id=uuid4().hex,
            )
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
        self,
        workflow: Workflow,
        start: datetime,
        end: datetime,
        expected_results: list[WorkflowGroupHistory],
        cursor: Cursor | None = None,
        per_page: int = 25,
    ) -> CursorResult[Group]:
        result = fetch_workflow_groups_paginated(workflow, start, end, cursor, per_page)
        assert result.results == expected_results, (result.results, expected_results)
        return result

    def test_workflow_groups_paginated__simple(self) -> None:
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
                    detector=self.detector_1,
                ),
                WorkflowGroupHistory(
                    self.group_3,
                    count=2,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[4].event_id,
                    detector=self.detector_3,
                ),
                WorkflowGroupHistory(
                    self.group_2,
                    count=1,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[3].event_id,
                    detector=self.detector_2,
                ),
            ],
        )

    def test_workflow_groups_paginated__cursor(self) -> None:
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
                    detector=self.detector_1,
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
                    detector=self.detector_3,
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
                    detector=self.detector_2,
                ),
            ],
            cursor=result.next,
            per_page=1,
        )

    def test_workflow_groups_paginated__filters_counts(self) -> None:
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
                    detector=self.detector_1,
                ),
                WorkflowGroupHistory(
                    self.group_2,
                    count=1,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[3].event_id,
                    detector=self.detector_2,
                ),
                WorkflowGroupHistory(
                    self.group_3,
                    count=1,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[4].event_id,
                    detector=self.detector_3,
                ),
            ],
        )

    def test_workflow_groups_paginated__past_date_range(self) -> None:
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
                    detector=self.detector_1,
                ),
            ],
        )
