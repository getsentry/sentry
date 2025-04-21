from datetime import timedelta
from uuid import uuid4

from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.endpoints.organization_workflow_group_history import (
    fetch_workflow_groups_paginated,
)
from sentry.workflow_engine.endpoints.serializers import (
    WorkflowGroupHistory,
    WorkflowGroupHistorySerializer,
)
from sentry.workflow_engine.models import WorkflowFireHistory

pytestmark = [requires_snuba]


@freeze_time()
class WorkflowGroupHistoryEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-group-history"

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

    def assert_correct_pagination(self, rule, start, end, expected, cursor=None, per_page=25):
        result = fetch_workflow_groups_paginated(rule, start, end, cursor, per_page)
        assert result.results == expected, (result.results, expected)
        return result

    def test_workflow_groups_paginated(self):
        self.assert_correct_pagination(
            self.workflow,
            before_now(days=6),
            before_now(days=0),
            [
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
        result = self.assert_correct_pagination(
            self.workflow,
            before_now(days=6),
            before_now(days=0),
            [
                WorkflowGroupHistory(
                    self.group,
                    count=3,
                    last_triggered=self.base_triggered_date,
                    event_id=self.history[0].event_id,
                ),
            ],
            per_page=1,
        )
        result = self.assert_correct_pagination(
            self.workflow,
            before_now(days=6),
            before_now(days=0),
            [
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
        self.assert_correct_pagination(
            self.workflow,
            before_now(days=6),
            before_now(days=0),
            [
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

        self.assert_correct_pagination(
            self.workflow,
            before_now(days=1),
            before_now(days=0),
            [
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

        self.assert_correct_pagination(
            self.workflow,
            before_now(days=3),
            before_now(days=2),
            [
                WorkflowGroupHistory(
                    self.group,
                    count=1,
                    last_triggered=self.base_triggered_date - timedelta(days=2),
                    event_id=self.history[2].event_id,
                ),
            ],
        )

    def test_simple(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.workflow.id,
            start=before_now(days=6),
            end=before_now(days=0),
        )
        assert resp.data == serialize(
            [
                WorkflowGroupHistory(
                    self.group, 3, self.base_triggered_date, self.history[0].event_id
                ),
                WorkflowGroupHistory(
                    self.group_3, 2, self.base_triggered_date, self.history[4].event_id
                ),
                WorkflowGroupHistory(
                    self.group_2, 1, self.base_triggered_date, self.history[3].event_id
                ),
            ],
            self.user,
            WorkflowGroupHistorySerializer(),
        )

    def test_pagination(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.workflow.id,
            start=before_now(days=6),
            end=before_now(days=0),
            per_page=1,
        )
        assert resp.data == serialize(
            [
                WorkflowGroupHistory(
                    self.group, 3, self.base_triggered_date, self.history[0].event_id
                )
            ],
            self.user,
            WorkflowGroupHistorySerializer(),
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.workflow.id,
            start=before_now(days=6),
            end=before_now(days=0),
            per_page=1,
            cursor=self.get_cursor_headers(resp)[1],
        )
        assert resp.data == serialize(
            [
                WorkflowGroupHistory(
                    self.group_3, 2, self.base_triggered_date, self.history[4].event_id
                ),
            ],
            self.user,
            WorkflowGroupHistorySerializer(),
        )

    def test_invalid_dates(self):
        self.get_error_response(
            self.organization.slug,
            self.workflow.id,
            start=before_now(days=0),
            end=before_now(days=6),
            status_code=400,
        )
