from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.monitors.grouptype import MonitorIncidentType
from sentry.monitors.models import Monitor, ScheduleType
from sentry.monitors.serializers import MonitorSerializer
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class BaseDetectorTestCase(APITestCase):
    def setUp(self) -> None:
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


@cell_silo_test
class OrganizationDetectorIndexGetTest(BaseDetectorTestCase):
    endpoint = "sentry-api-0-organization-detector-index"

    def test_list_monitor_incident_detectors(self) -> None:
        response = self.get_success_response(self.organization.slug)

        detector_data = response.data[2]

        assert detector_data == {
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


@cell_silo_test
class OrganizationDetectorIndexPutTest(BaseDetectorTestCase):
    endpoint = "sentry-api-0-organization-detector-details"
    method = "put"

    def test_update_monitor_incident_detector(self) -> None:
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

    def test_update_monitor_config_through_detector(self) -> None:
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


@cell_silo_test
class OrganizationDetectorDeleteTest(BaseDetectorTestCase):
    endpoint = "sentry-api-0-organization-detector-details"
    method = "delete"

    def test_delete_monitor_incident_detector(self) -> None:
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
