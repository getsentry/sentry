from uuid import uuid4

from sentry.api.serializers import serialize
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.endpoints.serializers.workflow_group_history_serializer import (
    WorkflowGroupHistory,
    WorkflowGroupHistorySerializer,
)
from sentry.workflow_engine.models import DetectorGroup
from sentry.workflow_engine.models.workflow_fire_history import WorkflowFireHistory

pytestmark = [requires_snuba]


@freeze_time()
class WorkflowGroupHistoryEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-group-history"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group()
        self.project = self.group.project
        self.organization = self.project.organization

        self.history: list[WorkflowFireHistory] = []
        self.workflow = self.create_workflow(organization=self.organization)
        self.detector = self.create_detector(
            project=self.project,
            type=ErrorGroupType.slug,
        )
        DetectorGroup.objects.create(
            detector=self.detector,
            group=self.group,
        )
        for i in range(3):
            self.history.append(
                WorkflowFireHistory(
                    workflow=self.workflow,
                    group=self.group,
                    event_id=uuid4().hex,
                )
            )
        self.group_2 = self.create_group()
        self.detector_2 = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
        )
        DetectorGroup.objects.create(
            detector=self.detector_2,
            group=self.group_2,
        )
        self.history.append(
            WorkflowFireHistory(
                workflow=self.workflow,
                group=self.group_2,
                event_id=uuid4().hex,
            )
        )
        histories: list[WorkflowFireHistory] = WorkflowFireHistory.objects.bulk_create(self.history)

        # manually update date_added
        for i in range(3):
            histories[i].update(date_added=before_now(days=i + 1))
        histories[-1].update(date_added=before_now(days=1))

        self.base_triggered_date = before_now(days=1)

        self.login_as(self.user)

    def test_simple(self) -> None:
        resp = self.get_success_response(
            self.organization.slug,
            self.workflow.id,
            start=before_now(days=6),
            end=before_now(days=0),
        )
        assert resp.data == serialize(
            [
                WorkflowGroupHistory(
                    self.group,
                    3,
                    self.base_triggered_date,
                    self.history[0].event_id,
                    detector=self.detector,
                ),
                WorkflowGroupHistory(
                    self.group_2,
                    1,
                    self.base_triggered_date,
                    self.history[-1].event_id,
                    detector=self.detector_2,
                ),
            ],
            self.user,
            WorkflowGroupHistorySerializer(),
        )

    def test_pagination(self) -> None:
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
                    self.group,
                    3,
                    self.base_triggered_date,
                    self.history[0].event_id,
                    detector=self.detector,
                )
            ],
            self.user,
            WorkflowGroupHistorySerializer(),
        )
        assert resp["X-Hits"] == "2"  # 2 unique groups, not 4 total history records

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
                    detector=self.detector_2,
                )
            ],
            self.user,
            WorkflowGroupHistorySerializer(),
        )
        assert resp["X-Hits"] == "2"  # 2 unique groups, not 4 total history records

    def test_invalid_dates_error(self) -> None:
        self.get_error_response(
            self.organization.slug,
            self.workflow.id,
            start=before_now(days=0),
            end=before_now(days=6),
            status_code=400,
        )
