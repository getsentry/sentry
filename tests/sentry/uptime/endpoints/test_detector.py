from django.utils import timezone
from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.uptime.detectors.result_handler import CHECKSTATUS_SUCCESS
from sentry.uptime.grouptype import UptimeDomainCheckFailure, UptimeMonitorMode, UptimeStatus
from sentry.uptime.models import CHECKSTATUS_FAILURE, ProjectUptimeSubscription, UptimeSubscription
from sentry.uptime.subscriptions.subscriptions import create_uptime_subscription
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


def _get_valid_data(project_id, environment_name, **overrides):
    data = {
        "projectId": project_id,
        "name": "Test Uptime Detector",
        "type": UptimeDomainCheckFailure.slug,
        "dataSource": {
            "timeout_ms": 30000,
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
            "environment": environment_name,
            "mode": UptimeMonitorMode.MANUAL.value,
        },
    }
    data.update(overrides)
    return data


class UptimeDetectorBaseTest(APITestCase):
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


class OrganizationDetectorDetailsPutTest(UptimeDetectorBaseTest):
    endpoint = "sentry-api-0-organization-detector-details"

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
                status_code=status.HTTP_200_OK,
                method="PUT",
            )

            updated_sub: UptimeSubscription = UptimeSubscription.objects.get(
                id=self.uptime_subscription.id
            )
            assert updated_sub.timeout_ms == 15000

    def test_update_invalid(self) -> None:
        valid_data = {
            "id": self.detector.id,
            "projectId": self.project.id,
            "name": "Test Uptime Detector",
            "type": UptimeDomainCheckFailure.slug,
            "dateCreated": self.detector.date_added,
            "dateUpdated": timezone.now(),
            "dataSource": {
                "timeout_ms": 80000,
            },
            "conditionGroup": {
                "id": self.data_condition_group.id,
                "organizationId": self.organization.id,
            },
            "config": self.detector.config,
        }

        with self.tasks():
            response = self.get_error_response(
                self.organization.slug,
                self.detector.id,
                **valid_data,
                status_code=status.HTTP_400_BAD_REQUEST,
                method="PUT",
            )

            assert "dataSource" in response.data
            assert "Ensure this value is less than or equal to 60000." in str(
                response.data["dataSource"]
            )


class OrganizationDetectorIndexPostTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-index"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_create_detector_validation_error(self):
        invalid_data = _get_valid_data(
            self.project.id, self.environment.name, dataSource={"timeout_ms": 80000}
        )
        with self.tasks():
            response = self.get_error_response(
                self.organization.slug,
                **invalid_data,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

            assert "dataSource" in response.data
            assert "Ensure this value is less than or equal to 60000" in str(
                response.data["dataSource"]
            )

    def test_create_detector(self):
        valid_data = _get_valid_data(
            self.project.id,
            self.environment.name,
        )
        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                **valid_data,
                status_code=status.HTTP_201_CREATED,
            )

            created_project: ProjectUptimeSubscription = ProjectUptimeSubscription.objects.get(
                project=self.project
            )
            created_sub: UptimeSubscription = UptimeSubscription.objects.get(
                id=created_project.uptime_subscription.id
            )

            detector = Detector.objects.get(id=response.data["id"])
            assert detector.name == "Test Uptime Detector"
            assert detector.type == UptimeDomainCheckFailure.slug
            assert detector.project_id == self.project.id

            assert created_project.name == "Test Uptime Detector"
            assert created_sub.timeout_ms == 30000
            assert created_sub.url == "https://www.google.com"
            assert created_sub.interval_seconds == UptimeSubscription.IntervalSeconds.ONE_MINUTE

    def test_create_detector_optional_fields(self):
        valid_data = _get_valid_data(
            self.project.id,
            self.environment.name,
            dataSource={
                "timeout_ms": 30000,
                "name": "Test Uptime Detector",
                "url": "https://www.google.com",
                "interval_seconds": UptimeSubscription.IntervalSeconds.ONE_MINUTE,
                "method": "PUT",
                "headers": [["key", "value"]],
                "body": "<html/>",
                "trace_sampling": True,
            },
        )
        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                **valid_data,
                status_code=status.HTTP_201_CREATED,
            )

            created_project: ProjectUptimeSubscription = ProjectUptimeSubscription.objects.get(
                project=self.project
            )
            created_sub: UptimeSubscription = UptimeSubscription.objects.get(
                id=created_project.uptime_subscription.id
            )

            detector = Detector.objects.get(id=response.data["id"])
            assert detector.name == "Test Uptime Detector"
            assert detector.type == UptimeDomainCheckFailure.slug
            assert detector.project_id == self.project.id

            assert created_project.name == "Test Uptime Detector"
            assert created_sub.timeout_ms == 30000
            assert created_sub.url == "https://www.google.com"
            assert created_sub.interval_seconds == UptimeSubscription.IntervalSeconds.ONE_MINUTE
            assert created_sub.method == "PUT"
            assert created_sub.headers == [["key", "value"]]
            assert created_sub.body == "<html/>"
            assert created_sub.trace_sampling is True
