from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineIncidentSerializer,
)
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod, IncidentType
from tests.sentry.incidents.serializers.test_workflow_engine_base import TestWorklowEngineSerializer


class TestDetectorSerializer(TestWorklowEngineSerializer):
    def setUp(self) -> None:
        super().setUp()
        self.add_warning_trigger()
        self.add_incident_data()
        self.expected_activities = None  # TODO add activities
        self.incident_expected = {
            "id": str(self.incident_group_open_period.incident_id),
            "identifier": str(self.group_open_period.id),  # temp and wrong
            "organizationId": str(self.group_open_period.project.organization_id),
            "projects": [self.project.slug],
            "alertRule": self.expected,
            "activities": self.expected_activities,
            "status": IncidentStatus.CRITICAL.value,
            "statusMethod": IncidentStatusMethod.RULE_TRIGGERED.value,
            "type": IncidentType.ALERT_TRIGGERED.value,
            "title": self.group.title,
            "dateStarted": self.group_open_period.date_started,
            "dateDetected": self.group_open_period.date_started,
            "dateCreated": self.group_open_period.date_added,
            "dateClosed": (
                self.group_open_period.date_ended.replace(second=0, microsecond=0)
                if self.group_open_period.date_ended
                else None
            ),
        }

    def test_simple(self) -> None:
        serialized_incident = serialize(
            self.group_open_period, self.user, WorkflowEngineIncidentSerializer()
        )
        assert serialized_incident == self.incident_expected
