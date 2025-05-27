from datetime import timedelta

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineDetailedIncidentSerializer,
    WorkflowEngineIncidentSerializer,
)
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models.incident import (
    IncidentActivityType,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentType,
)
from sentry.issues.priority import PriorityChangeReason
from sentry.models.activity import Activity
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from tests.sentry.incidents.serializers.test_workflow_engine_base import (
    TestWorkflowEngineSerializer,
)


class TestDetectorSerializer(TestWorkflowEngineSerializer):
    def setUp(self) -> None:
        super().setUp()
        self.add_warning_trigger()
        self.add_incident_data()
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

    def test_activity(self) -> None:
        incident_activity_id = "-1"  # temp and wrong

        open_period_activities = []
        created = {
            "id": incident_activity_id,
            "incidentIdentifier": self.incident_identifier,
            "type": IncidentActivityType.CREATED,
            "value": None,
            "previousValue": None,
            "user": None,
            "comment": None,
            "dateCreated": self.group_open_period.date_started,
        }
        detected = created.copy()
        detected["type"] = IncidentActivityType.DETECTED
        open_period_activities.append(created)
        open_period_activities.append(detected)

        updated_warning = {
            "id": incident_activity_id,
            "incidentIdentifier": self.incident_identifier,
            "type": IncidentActivityType.STATUS_CHANGE,
            "value": IncidentStatus.WARNING,
            "previousValue": None,
            "user": None,
            "comment": None,
            "dateCreated": self.group_open_period.date_started,
        }
        open_period_activities.append(updated_warning)
        self.incident_expected["activities"] = open_period_activities

        serialized_incident = serialize(
            self.group_open_period,
            self.user,
            WorkflowEngineIncidentSerializer(expand=["activities"]),
        )
        assert serialized_incident == self.incident_expected

        # escalate to critical status
        update_incident_status(self.incident, IncidentStatus.CRITICAL)
        Activity.objects.create(
            project=self.group_open_period.group.project,
            group=self.group_open_period.group,
            type=ActivityType.SET_PRIORITY.value,
            data={
                "priority": PriorityLevel.HIGH.to_str(),
                "reason": PriorityChangeReason.ONGOING,
            },
            datetime=self.now + timedelta(minutes=5),
        )
        updated_critical = {
            "id": incident_activity_id,
            "incidentIdentifier": self.incident_identifier,
            "type": IncidentActivityType.STATUS_CHANGE,
            "value": IncidentStatus.CRITICAL,
            "previousValue": IncidentStatus.WARNING,
            "user": None,
            "comment": None,
            "dateCreated": self.group_open_period.date_started,
        }
        open_period_activities.append(updated_critical)
        serialized_incident = serialize(
            self.group_open_period,
            self.user,
            WorkflowEngineIncidentSerializer(expand=["activities"]),
        )
        assert serialized_incident == self.incident_expected

        # resolve incident
        update_incident_status(
            self.incident,
            IncidentStatus.CLOSED,
            IncidentStatusMethod.RULE_UPDATED,
            self.group_open_period.date_ended,
        )
        resolution_activity = Activity.objects.create(
            project=self.group_open_period.group.project,
            group=self.group_open_period.group,
            user_id=self.group_open_period.user_id,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            datetime=self.now + timedelta(minutes=10),
        )
        self.group_open_period.date_ended = self.now + timedelta(days=1)
        self.group_open_period.resolution_activity = resolution_activity
        self.group_open_period.save()

        resolved = {
            "id": incident_activity_id,
            "incidentIdentifier": self.incident_identifier,
            "type": IncidentActivityType.STATUS_CHANGE,
            "value": IncidentStatus.CLOSED,
            "previousValue": IncidentStatus.CRITICAL,
            "user": self.group_open_period.user_id,
            "comment": None,
            "dateCreated": self.group_open_period.date_started,
        }
        open_period_activities.append(resolved)
        self.incident_expected["statusMethod"] = IncidentStatusMethod.RULE_UPDATED.value
        self.incident_expected["status"] = IncidentStatus.CLOSED.value
        self.incident_expected["dateClosed"] = (
            self.group_open_period.date_ended.replace(second=0, microsecond=0)
            if self.group_open_period.date_ended
            else None
        )
        serialized_incident = serialize(
            self.group_open_period,
            self.user,
            WorkflowEngineIncidentSerializer(expand=["activities"]),
        )
        assert serialized_incident == self.incident_expected

    def test_detailed(self) -> None:
        serialized_incident = serialize(
            self.group_open_period, self.user, WorkflowEngineDetailedIncidentSerializer()
        )
        self.incident_expected["discoverQuery"] = "(event.type:error) AND (level:error)"
        assert serialized_incident == self.incident_expected
