from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.uptime.detectors.result_handler import CHECKSTATUS_SUCCESS
from sentry.uptime.grouptype import UptimeDomainCheckFailure, UptimeMonitorMode, UptimeStatus
from sentry.uptime.models import CHECKSTATUS_FAILURE, ProjectUptimeSubscription, UptimeSubscription
from sentry.uptime.subscriptions.subscriptions import create_uptime_subscription
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class UptimeDetectorBaseTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.environment = self.create_environment(
            organization_id=self.organization.id, name="production"
        )
        self.project = self.create_project()
        with self.tasks():
            self.uptime_subscription = create_uptime_subscription(
                url="https://www.google.com",
                interval_seconds=UptimeSubscription.IntervalSeconds.ONE_MINUTE,
                timeout_ms=30000,
                method=UptimeSubscription.SupportedHTTPMethods.GET,
                headers=[],
                body=None,
                trace_sampling=False,
                uptime_status=UptimeStatus.OK,
            )
            self.uptime_project = ProjectUptimeSubscription.objects.create(
                project=self.project,
                environment=self.environment,
                uptime_subscription=self.uptime_subscription,
                mode=UptimeMonitorMode.MANUAL.value,
                name="uptime project name",
                owner_user_id=self.user.id,
                owner_team_id=None,
            )
        self.data_source = self.create_data_source(
            organization=self.organization, source_id=self.uptime_subscription.id
        )

        self.data_condition_group: DataConditionGroup = DataConditionGroup.objects.create(
            organization=self.organization,
        )
        DataCondition.objects.create(
            comparison=CHECKSTATUS_FAILURE,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.data_condition_group,
        )
        DataCondition.objects.create(
            comparison=CHECKSTATUS_SUCCESS,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=self.data_condition_group,
        )

        self.detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            type=UptimeDomainCheckFailure.slug,
            config={
                "environment": self.environment.name,
                "mode": UptimeMonitorMode.MANUAL.value,
            },
            workflow_condition_group=self.data_condition_group,
        )
        self.data_source_detector = self.create_data_source_detector(
            data_source=self.data_source, detector=self.detector
        )
        assert self.detector.data_sources is not None


class UptimeDomainCheckFailureUpdateTest(UptimeDetectorBaseTest):
    def setUp(self) -> None:
        super().setUp()

        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }

    def test_update(self) -> None:
        valid_data = {
            "id": self.detector.id,
            "projectId": self.project.id,
            "name": "Test Uptime Detector",
            "type": UptimeDomainCheckFailure.slug,
            "dateCreated": self.detector.date_added,
            "dateUpdated": timezone.now(),
            "dataSource": {
                "timeout_ms": 15000,
            },
            "conditionGroup": {
                "id": self.data_condition_group.id,
                "organizationId": self.organization.id,
            },
            "config": self.detector.config,
        }

        with self.tasks():
            self.get_success_response(
                self.organization.slug,
                self.detector.id,
                **valid_data,
                status_code=200,
                method="PUT",
            )

            updated_sub: UptimeSubscription = UptimeSubscription.objects.get(
                id=self.uptime_subscription.id
            )
            assert updated_sub.timeout_ms == 15000


class OrganizationDetectorIndexPostTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-index"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_create_detector(self):
        valid_data = {
            "projectId": self.project.id,
            "name": "Test Uptime Detector",
            "type": UptimeDomainCheckFailure.slug,
            "dataSource": {
                "timeout_ms": 15000,
                "name": "Test Uptime Detector",
                "url": "https://www.google.com",
                "interval_seconds": UptimeSubscription.IntervalSeconds.ONE_MINUTE,
            },
            "conditionGroup": {
                "logicType": "any",
                "conditions": [
                    {"comparison": 1, "type": "eq", "condition_result": "high"},
                    {"comparison": 0, "type": "eq", "condition_result": "ok"},
                ],
            },
            "config": {
                "environment": self.environment.name,
                "mode": UptimeMonitorMode.MANUAL.value,
            },
        }
        with self.tasks():
            self.get_success_response(
                self.organization.slug,
                **valid_data,
                status_code=201,
            )

        created_project: ProjectUptimeSubscription = ProjectUptimeSubscription.objects.get(
            project=self.project
        )
        created_sub: UptimeSubscription = UptimeSubscription.objects.get(
            id=created_project.uptime_subscription.id
        )
        assert created_sub.timeout_ms == 15000
