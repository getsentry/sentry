from django.utils import timezone
from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.models import UptimeStatus, UptimeSubscription, get_uptime_subscription
from sentry.uptime.types import UptimeMonitorMode
from sentry.workflow_engine.models import Detector


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
            "recovery_threshold": 1,
            "downtime_threshold": 1,
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

        self.uptime_subscription = self.create_uptime_subscription(
            url="https://www.google.com",
            interval_seconds=UptimeSubscription.IntervalSeconds.ONE_MINUTE,
            timeout_ms=30000,
            method=UptimeSubscription.SupportedHTTPMethods.GET,
            headers=[],
            body=None,
            trace_sampling=False,
            uptime_status=UptimeStatus.OK,
        )

        self.detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            uptime_subscription=self.uptime_subscription,
            name="Test Detector",
        )


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
        assert self.detector.workflow_condition_group
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
                "id": self.detector.workflow_condition_group.id,
                "organizationId": self.organization.id,
            },
            "config": self.detector.config,
        }

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
        assert self.detector.workflow_condition_group

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
                "id": self.detector.workflow_condition_group.id,
                "organizationId": self.organization.id,
            },
            "config": self.detector.config,
        }

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

        response = self.get_success_response(
            self.organization.slug,
            **valid_data,
            status_code=status.HTTP_201_CREATED,
        )

        detector: Detector = Detector.objects.get(id=response.data["id"])
        created_sub: UptimeSubscription = get_uptime_subscription(detector)

        assert detector.name == "Test Uptime Detector"
        assert detector.type == UptimeDomainCheckFailure.slug
        assert detector.project_id == self.project.id

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

        response = self.get_success_response(
            self.organization.slug,
            **valid_data,
            status_code=status.HTTP_201_CREATED,
        )
        detector: Detector = Detector.objects.get(id=response.data["id"])
        created_sub: UptimeSubscription = get_uptime_subscription(detector)

        assert detector.name == "Test Uptime Detector"
        assert detector.type == UptimeDomainCheckFailure.slug
        assert detector.project_id == self.project.id

        assert created_sub.timeout_ms == 30000
        assert created_sub.url == "https://www.google.com"
        assert created_sub.interval_seconds == UptimeSubscription.IntervalSeconds.ONE_MINUTE
        assert created_sub.method == "PUT"
        assert created_sub.headers == [["key", "value"]]
        assert created_sub.body == "<html/>"
        assert created_sub.trace_sampling is True

    def test_create_detector_missing_config_property(self):
        invalid_data = _get_valid_data(
            self.project.id,
            self.environment.name,
            config={
                "environment": self.environment.name,
                "mode": UptimeMonitorMode.MANUAL.value,
                "recovery_threshold": 1,
            },
        )

        response = self.get_error_response(
            self.organization.slug,
            **invalid_data,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        assert "config" in response.data
        assert "downtime_threshold" in str(response.data["config"])
