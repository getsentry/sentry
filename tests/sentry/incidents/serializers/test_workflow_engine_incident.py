from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.alert_rule import DetailedAlertRuleSerializer
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineDetailedIncidentSerializer,
    WorkflowEngineIncidentSerializer,
)
from sentry.incidents.models.incident import Incident
from tests.sentry.incidents.serializers.test_workflow_engine_base import (
    TestWorkflowEngineSerializer,
)


class TestIncidentSerializer(TestWorkflowEngineSerializer):
    def setUp(self) -> None:
        super().setUp()
        self.add_warning_trigger()
        self.add_incident_data()
        incident = Incident.objects.get(id=self.incident_group_open_period.incident_id)
        self.incident_identifier = str(self.incident_group_open_period.incident_identifier)
        alert_rule_serializer = DetailedAlertRuleSerializer()
        self.incident_expected = {
            "id": str(self.incident_group_open_period.incident_id),
            "identifier": self.incident_identifier,
            "organizationId": str(incident.organization_id),
            "projects": [self.project.slug],
            "alertRule": serialize(incident.alert_rule, serializer=alert_rule_serializer),
            "activities": None,
            "status": incident.status,
            "statusMethod": incident.status_method,
            "type": incident.type,
            "title": incident.title,
            "dateStarted": incident.date_started,
            "dateDetected": incident.date_detected,
            "dateCreated": incident.date_added,
            "dateClosed": incident.date_closed,
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
