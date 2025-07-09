from uuid import uuid4

from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
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
        histories: list[WorkflowFireHistory] = WorkflowFireHistory.objects.bulk_create(self.history)

        # manually update date_added
        for i in range(3):
            histories[i].update(date_added=before_now(days=i + 1))
        histories[-1].update(date_added=before_now(days=1))

        self.base_triggered_date = before_now(days=1)

        self.login_as(self.user)

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
                    self.group, 3, self.base_triggered_date, self.history[0].event_id, detector=None
                ),
                WorkflowGroupHistory(
                    self.group_2,
                    1,
                    self.base_triggered_date,
                    self.history[-1].event_id,
                    detector=None,
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
                    self.group, 3, self.base_triggered_date, self.history[0].event_id, detector=None
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
                    self.group_2,
                    1,
                    self.base_triggered_date,
                    self.history[-1].event_id,
                    detector=None,
                )
            ],
            self.user,
            WorkflowGroupHistorySerializer(),
        )

    def test_invalid_dates_error(self):
        self.get_error_response(
            self.organization.slug,
            self.workflow.id,
            start=before_now(days=0),
            end=before_now(days=6),
            status_code=400,
        )
