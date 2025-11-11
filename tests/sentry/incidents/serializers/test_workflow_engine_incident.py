from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineDetailedIncidentSerializer,
    WorkflowEngineIncidentSerializer,
)
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod, IncidentType
from tests.sentry.incidents.serializers.test_workflow_engine_base import (
    TestWorkflowEngineSerializer,
)


class TestIncidentSerializer(TestWorkflowEngineSerializer):
    def setUp(self) -> None:
        super().setUp()
        self.add_warning_trigger()
        self.add_incident_data()
        self.create_detector_group(detector=self.detector, group=self.group_open_period.group)
        self.incident_identifier = str(self.incident_group_open_period.incident_identifier)
        self.incident_expected = {
            "id": str(self.incident_group_open_period.incident_id),
            "identifier": self.incident_identifier,
            "organizationId": str(self.group_open_period.project.organization_id),
            "projects": [self.project.slug],
            "alertRule": self.expected,
            "activities": None,
            "status": IncidentStatus.CRITICAL.value,
            "statusMethod": IncidentStatusMethod.RULE_TRIGGERED.value,
            "type": IncidentType.ALERT_TRIGGERED.value,
            "title": self.group.title,
            "dateStarted": self.group_open_period.date_started,
            "dateDetected": self.group_open_period.date_started,
            "dateCreated": self.group_open_period.date_added,
            "dateClosed": None,
        }

    def test_simple(self) -> None:
        serialized_incident = serialize(
            self.group_open_period, self.user, WorkflowEngineIncidentSerializer()
        )
        assert serialized_incident == self.incident_expected

    def test_detailed(self) -> None:
        serialized_incident = serialize(
            self.group_open_period, self.user, WorkflowEngineDetailedIncidentSerializer()
        )
        self.incident_expected["discoverQuery"] = "(event.type:error) AND (level:error)"
        assert serialized_incident == self.incident_expected
