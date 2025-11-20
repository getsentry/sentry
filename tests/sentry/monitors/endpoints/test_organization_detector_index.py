from rest_framework import status

from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.monitors.grouptype import MonitorIncidentType
from sentry.monitors.models import Monitor, ScheduleType, is_monitor_muted
from sentry.monitors.serializers import MonitorSerializer
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector


@region_silo_test
class BaseDetectorTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="Original Monitor",
            slug="original-monitor",
            status=ObjectStatus.ACTIVE,
            config={
                "schedule": "0 * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": 5,
                "max_runtime": 30,
            },
        )
        self.data_source = self.create_data_source(
            organization=self.organization,
            type=DATA_SOURCE_CRON_MONITOR,
            source_id=str(self.monitor.id),
        )
        self.condition_group = self.create_data_condition_group()
        self.detector = self.create_detector(
            project=self.project,
            type=MonitorIncidentType.slug,
            name="Original Detector",
            workflow_condition_group=self.condition_group,
        )
        self.create_data_source_detector(data_source=self.data_source, detector=self.detector)


@region_silo_test
class OrganizationDetectorIndexGetTest(BaseDetectorTestCase):
    endpoint = "sentry-api-0-organization-detector-index"

    def test_list_monitor_incident_detectors(self):
        response = self.get_success_response(self.organization.slug)

        detector_data = response.data[0]

        assert response.data == [
            {
                "id": str(self.detector.id),
                "projectId": str(self.project.id),
                "name": "Original Detector",
                "description": None,
                "type": MonitorIncidentType.slug,
                "workflowIds": [],
                "owner": None,
                "createdBy": None,
                "dateCreated": detector_data["dateCreated"],
                "dateUpdated": detector_data["dateUpdated"],
                "dataSources": [
                    {
                        "id": detector_data["dataSources"][0]["id"],
                        "organizationId": str(self.organization.id),
                        "type": DATA_SOURCE_CRON_MONITOR,
                        "sourceId": str(self.monitor.id),
                        "queryObj": serialize(
                            self.monitor, user=self.user, serializer=MonitorSerializer()
                        ),
                    }
                ],
                "conditionGroup": detector_data["conditionGroup"],
                "config": {},
                "enabled": True,
                "alertRuleId": None,
                "ruleId": None,
                "latestGroup": None,
                "openIssues": 0,
            }
        ]


@region_silo_test
class OrganizationDetectorIndexPostTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-index"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def _get_detector_post_data(self, **overrides):
        data = {
            "projectId": self.project.id,
            "type": MonitorIncidentType.slug,
            "name": "Test Monitor Detector",
            "dataSources": [
                {
                    "name": "Test Monitor",
                    "config": {
                        "schedule": "0 * * * *",
                        "scheduleType": "crontab",
                    },
                }
            ],
        }
        data.update(overrides)
        return data

    def test_create_monitor_incident_detector_validates_correctly(self):
        data = self._get_detector_post_data()
        response = self.get_success_response(
            self.organization.slug,
            **data,
            status_code=201,
        )

        assert response.data["name"] == "Test Monitor Detector"
        assert response.data["type"] == MonitorIncidentType.slug

        monitor = Monitor.objects.get(organization_id=self.organization.id, slug="test-monitor")
        assert monitor.name == "Test Monitor"
        assert monitor.config["schedule"] == "0 * * * *"
        assert monitor.config["schedule_type"] == ScheduleType.CRONTAB
        assert monitor.project_id == self.project.id
        assert monitor.organization_id == self.organization.id

        detector = Detector.objects.get(id=response.data["id"])
        assert detector.name == "Test Monitor Detector"
        assert detector.type == MonitorIncidentType.slug
        assert detector.project_id == self.project.id

        data_source = DataSource.objects.get(
            organization_id=self.organization.id,
            type=DATA_SOURCE_CRON_MONITOR,
            source_id=str(monitor.id),
        )
        assert DataSourceDetector.objects.filter(
            data_source=data_source, detector=detector
        ).exists()

        data_sources = response.data["dataSources"]
        assert len(data_sources) == 1
        data_source_data = data_sources[0]
        assert data_source_data["type"] == DATA_SOURCE_CRON_MONITOR
        assert data_source_data["sourceId"] == str(monitor.id)

        expected_monitor_data = serialize(monitor, user=self.user, serializer=MonitorSerializer())
        assert data_source_data["queryObj"] == expected_monitor_data

    def test_create_monitor_incident_detector_validation_error(self):
        data = self._get_detector_post_data(
            dataSources=[
                {
                    "config": {
                        "schedule": "invalid cron",
                        "scheduleType": "crontab",
                    },
                }
            ]
        )
        response = self.get_error_response(
            self.organization.slug,
            **data,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert "dataSources" in response.data
        assert "Either name or slug must be provided" in str(response.data["dataSources"])

    def test_create_monitor_with_optional_fields(self):
        data = self._get_detector_post_data(
            dataSources=[
                {
                    "name": "Full Config Monitor",
                    "slug": "full-config-monitor",
                    "status": "disabled",
                    "isMuted": False,
                    "config": {
                        "schedule": "*/30 * * * *",
                        "scheduleType": "crontab",
                        "checkinMargin": 15,
                        "maxRuntime": 120,
                        "timezone": "America/New_York",
                        "failureIssueThreshold": 3,
                        "recoveryThreshold": 2,
                    },
                }
            ],
        )
        self.get_success_response(
            self.organization.slug,
            **data,
            status_code=201,
        )

        monitor = Monitor.objects.get(
            organization_id=self.organization.id, slug="full-config-monitor"
        )
        assert monitor.name == "Full Config Monitor"
        assert monitor.status == ObjectStatus.DISABLED
        assert is_monitor_muted(monitor) is False
        assert monitor.config["schedule"] == "*/30 * * * *"
        assert monitor.config["checkin_margin"] == 15
        assert monitor.config["max_runtime"] == 120
        assert monitor.config["timezone"] == "America/New_York"
        assert monitor.config["failure_issue_threshold"] == 3
        assert monitor.config["recovery_threshold"] == 2


@region_silo_test
class OrganizationDetectorIndexPutTest(BaseDetectorTestCase):
    endpoint = "sentry-api-0-organization-detector-details"
    method = "put"

    def test_update_monitor_incident_detector(self):
        new_user = self.create_user()
        self.create_member(user=new_user, organization=self.organization)
        data = {
            "name": "Updated Detector",
            "owner": new_user.get_actor_identifier(),
        }
        response = self.get_success_response(
            self.organization.slug,
            self.detector.id,
            **data,
            status_code=200,
        )

        assert response.data["name"] == "Updated Detector"
        assert response.data["owner"] == {
            "email": new_user.email,
            "id": str(new_user.id),
            "name": new_user.get_username(),
            "type": "user",
        }
        assert response.data["type"] == MonitorIncidentType.slug

        self.detector.refresh_from_db()
        assert self.detector.name == "Updated Detector"
        assert self.detector.owner_user_id == new_user.id
        assert self.detector.owner_team_id is None

        self.monitor.refresh_from_db()
        assert self.monitor.name == "Original Monitor"
        assert self.monitor.slug == "original-monitor"

    def test_update_monitor_config_through_detector(self):
        data = {
            "name": "Updated Detector With Monitor Config",
            "dataSources": [
                {
                    "name": "Updated Monitor Name",
                    "config": {
                        "schedule": "*/30 * * * *",
                        "scheduleType": "crontab",
                        "checkinMargin": 10,
                        "maxRuntime": 60,
                    },
                }
            ],
        }
        self.get_success_response(
            self.organization.slug,
            self.detector.id,
            **data,
            status_code=200,
        )

        self.detector.refresh_from_db()
        assert self.detector.name == "Updated Detector With Monitor Config"

        self.monitor.refresh_from_db()
        assert self.monitor.name == "Updated Monitor Name"
        assert self.monitor.config["schedule"] == "*/30 * * * *"
        assert self.monitor.config["checkin_margin"] == 10
        assert self.monitor.config["max_runtime"] == 60


@region_silo_test
class OrganizationDetectorDeleteTest(BaseDetectorTestCase):
    endpoint = "sentry-api-0-organization-detector-details"
    method = "delete"

    def test_delete_monitor_incident_detector(self):
        detector_id = self.detector.id
        monitor_id = self.monitor.id
        self.get_success_response(
            self.organization.slug,
            detector_id,
            status_code=204,
        )
        self.detector.refresh_from_db()
        assert self.detector.status == ObjectStatus.PENDING_DELETION
        assert Monitor.objects.filter(id=monitor_id).exists()
