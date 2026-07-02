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

    def test_sort_by_last_triggered(self) -> None:
        """Default sort is lastTriggered DESC. Explicit sort=-count orders by count DESC."""
        workflow = self.create_workflow(organization=self.organization)

        group_old = self.create_group()
        group_new = self.create_group()

        # group_old: 3 triggers, last triggered 3 days ago
        for i in range(3):
            wfh = WorkflowFireHistory.objects.create(
                workflow=workflow, group=group_old, event_id=uuid4().hex
            )
            wfh.update(date_added=before_now(days=3 + i))

        # group_new: 1 trigger, last triggered 1 day ago
        wfh = WorkflowFireHistory.objects.create(
            workflow=workflow, group=group_new, event_id=uuid4().hex
        )
        wfh.update(date_added=before_now(days=1))

        # Default sort (lastTriggered DESC): group_new first (more recent)
        resp = self.get_success_response(
            self.organization.slug,
            workflow.id,
            start=before_now(days=10),
            end=before_now(days=0),
        )
        assert resp.data[0]["count"] == 1
        assert resp.data[1]["count"] == 3

        # Explicit sort by count DESC: group_old first (more triggers)
        resp = self.get_success_response(
            self.organization.slug,
            workflow.id,
            start=before_now(days=10),
            end=before_now(days=0),
            sort="-count",
        )
        assert resp.data[0]["count"] == 3
        assert resp.data[1]["count"] == 1

    def test_multiple_sorts(self) -> None:
        """Multiple sort params are applied in order."""
        workflow = self.create_workflow(organization=self.organization)

        group_a = self.create_group()
        group_b = self.create_group()

        # Both groups have 2 triggers, but group_a was triggered more recently
        for i in range(2):
            wfh = WorkflowFireHistory.objects.create(
                workflow=workflow, group=group_a, event_id=uuid4().hex
            )
            wfh.update(date_added=before_now(days=1 + i))

        for i in range(2):
            wfh = WorkflowFireHistory.objects.create(
                workflow=workflow, group=group_b, event_id=uuid4().hex
            )
            wfh.update(date_added=before_now(days=3 + i))

        # sort=-count&sort=-lastTriggered: tied on count, group_a first (more recent)
        resp = self.get_success_response(
            self.organization.slug,
            workflow.id,
            start=before_now(days=10),
            end=before_now(days=0),
            sort=["-count", "-lastTriggered"],
        )
        assert resp.data[0]["group"]["id"] == str(group_a.id)
        assert resp.data[1]["group"]["id"] == str(group_b.id)

        # sort=-count&sort=lastTriggered: tied on count, group_b first (oldest)
        resp = self.get_success_response(
            self.organization.slug,
            workflow.id,
            start=before_now(days=10),
            end=before_now(days=0),
            sort=["-count", "lastTriggered"],
        )
        assert resp.data[0]["group"]["id"] == str(group_b.id)
        assert resp.data[1]["group"]["id"] == str(group_a.id)

    def test_invalid_sort_field(self) -> None:
        self.get_error_response(
            self.organization.slug,
            self.workflow.id,
            start=before_now(days=6),
            end=before_now(days=0),
            sort="invalid",
            status_code=400,
        )

    def test_invalid_dates_error(self) -> None:
        self.get_error_response(
            self.organization.slug,
            self.workflow.id,
            start=before_now(days=0),
            end=before_now(days=6),
            status_code=400,
        )
