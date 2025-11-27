from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.monitors.grouptype import MonitorIncidentType
from sentry.monitors.models import Monitor, ScheduleType
from sentry.monitors.serializers import MonitorSerializer
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector


@region_silo_test
class OrganizationMonitorIncidentDetectorDetailsTest(APITestCase):
    """Test PUT/DELETE operations for monitor incident detectors."""

    endpoint = "sentry-api-0-organization-detector-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="Test Monitor",
            slug="test-monitor",
            config={
                "schedule": "0 * * * *",
                "schedule_type": ScheduleType.CRONTAB,
            },
        )
        self.data_source = DataSource.objects.create(
            organization_id=self.organization.id,
            type=DATA_SOURCE_CRON_MONITOR,
            source_id=str(self.monitor.id),
        )
        self.detector = Detector.objects.create(
            project=self.project,
            type=MonitorIncidentType.slug,
            name="Monitor Incident Detector",
            owner_user_id=self.user.id,
            config={},
        )
        DataSourceDetector.objects.create(
            data_source=self.data_source,
            detector=self.detector,
        )

    def test_get_monitor_incident_detector_details(self):
        """Test getting a monitor incident detector details with proper monitor serialization."""
        response = self.get_success_response(
            self.organization.slug,
            self.detector.id,
            status_code=200,
            method="GET",
        )
        assert response.data == {
            "id": str(self.detector.id),
            "projectId": str(self.project.id),
            "name": "Monitor Incident Detector",
            "description": None,
            "type": MonitorIncidentType.slug,
            "workflowIds": [],
            "owner": {
                "email": self.user.email,
                "id": str(self.user.id),
                "name": self.user.get_username(),
                "type": "user",
            },
            "createdBy": None,
            "dateCreated": response.data["dateCreated"],
            "dateUpdated": response.data["dateUpdated"],
            "dataSources": [
                {
                    "id": response.data["dataSources"][0]["id"],
                    "organizationId": str(self.organization.id),
                    "type": DATA_SOURCE_CRON_MONITOR,
                    "sourceId": str(self.monitor.id),
                    "queryObj": serialize(
                        self.monitor, user=self.user, serializer=MonitorSerializer()
                    ),
                }
            ],
            "conditionGroup": None,
            "config": {},
            "enabled": True,
            "alertRuleId": None,
            "ruleId": None,
            "latestGroup": None,
            "openIssues": 0,
        }

    def test_update_monitor_incident_detector(self):
        """Test updating a monitor incident detector name and owner."""
        team = self.create_team(organization=self.organization)

        original_monitor_name = self.monitor.name
        original_monitor_config = self.monitor.config.copy()

        data = {
            "name": "Updated Monitor Detector",
            "owner": f"team:{team.id}",
        }

        response = self.get_success_response(
            self.organization.slug,
            self.detector.id,
            **data,
            status_code=200,
            method="PUT",
        )

        assert response.data["name"] == "Updated Monitor Detector"
        assert response.data["owner"] == {
            "id": str(team.id),
            "name": team.slug,
            "type": "team",
        }
        assert response.data["type"] == MonitorIncidentType.slug

        self.monitor.refresh_from_db()
        expected_data_sources = [
            {
                "id": response.data["dataSources"][0]["id"],
                "organizationId": str(self.organization.id),
                "type": DATA_SOURCE_CRON_MONITOR,
                "sourceId": str(self.monitor.id),
                "queryObj": serialize(self.monitor, user=self.user, serializer=MonitorSerializer()),
            }
        ]
        assert response.data["dataSources"] == expected_data_sources

        self.detector.refresh_from_db()
        assert self.detector.name == "Updated Monitor Detector"
        assert self.detector.owner_team_id == team.id
        assert self.detector.owner_user_id is None
        assert self.monitor.name == original_monitor_name
        assert self.monitor.config == original_monitor_config

    def test_update_monitor_incident_detector_with_data_sources(self):
        """Test updating a monitor detector with dataSources field (including existing slug)."""
        data = {
            "name": "Updated Name",
            "dataSources": [
                {
                    "name": "Updated Monitor Name",
                    "slug": self.monitor.slug,  # Keep the existing slug
                    "config": {
                        "checkin_margin": 1,
                        "failure_issue_threshold": 1,
                        "max_runtime": 30,
                        "recovery_threshold": 1,
                        "timezone": "UTC",
                        "schedule": "0 0 * * 5",
                        "schedule_type": "crontab",
                    },
                }
            ],
        }

        response = self.get_success_response(
            self.organization.slug,
            self.detector.id,
            **data,
            status_code=200,
            method="PUT",
        )

        assert response.data["name"] == "Updated Name"

        self.monitor.refresh_from_db()
        assert self.monitor.name == "Updated Monitor Name"
        assert self.monitor.slug == "test-monitor"  # Slug unchanged
        assert self.monitor.config["schedule"] == "0 0 * * 5"

    def test_delete_monitor_incident_detector(self):
        """Test deleting a monitor incident detector."""
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                self.detector.id,
                method="DELETE",
            )

        assert RegionScheduledDeletion.objects.filter(
            model_name="Detector", object_id=self.detector.id
        ).exists()

        self.detector.refresh_from_db()
        assert self.detector.status == ObjectStatus.PENDING_DELETION

        self.monitor.refresh_from_db()
        assert self.monitor.status == ObjectStatus.ACTIVE
