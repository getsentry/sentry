from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.utils import OFFSET
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineDetailedIncidentSerializer,
    WorkflowEngineIncidentSerializer,
)
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod, IncidentType
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import (
    ActionAlertRuleTriggerAction,
    AlertRuleDetector,
    DataConditionAlertRuleTrigger,
)
from tests.sentry.incidents.serializers.test_workflow_engine_base import (
    TestWorkflowEngineSerializer,
)


class TestIncidentSerializer(TestWorkflowEngineSerializer):
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

    def test_no_incident(self) -> None:
        """
        Assert that nothing breaks if the legacy models do not exist.
        """
        self.incident_group_open_period.delete()
        ard = AlertRuleDetector.objects.filter(detector_id=self.detector.id)
        dcart = DataConditionAlertRuleTrigger.objects.filter(
            data_condition_id=self.critical_detector_trigger.id
        )
        aarta = ActionAlertRuleTriggerAction.objects.filter(action_id=self.critical_action.id)

        ard.delete()
        dcart.delete()
        aarta.delete()

        serialized_incident = serialize(
            self.group_open_period, self.user, WorkflowEngineIncidentSerializer()
        )
        self.expected.update({"id": str(self.detector.id + OFFSET)})
        self.expected["triggers"][0].update(
            {
                "id": str(self.critical_detector_trigger.id + OFFSET),
                "alertRuleId": str(self.detector.id + OFFSET),
            }
        )
        self.expected["triggers"][1].update(
            {
                "alertRuleId": str(self.detector.id + OFFSET),
            }
        )
        self.expected["triggers"][0]["actions"][0].update(
            {
                "id": str(self.critical_action.id + OFFSET),
                "alertRuleTriggerId": str(self.critical_detector_trigger.id + OFFSET),
            }
        )

        self.incident_expected.update(
            {
                "id": str(self.group_open_period.id + OFFSET),
                "identifier": str(self.group_open_period.id + OFFSET),
            }
        )
        assert serialized_incident == self.incident_expected

    def test_with_activities(self) -> None:
        gopa = GroupOpenPeriodActivity.objects.create(
            date_added=self.group_open_period.date_added,
            group_open_period=self.group_open_period,
            type=OpenPeriodActivityType.OPENED,
            value=self.group.priority,
        )
        serialized_incident = serialize(
            self.group_open_period,
            self.user,
            WorkflowEngineIncidentSerializer(expand=["activities"]),
        )
        assert len(serialized_incident["activities"]) == 1
        serialized_activity = serialized_incident["activities"][0]
        assert serialized_activity == {
            "id": str(gopa.id),
            "type": OpenPeriodActivityType.OPENED.to_str(),
            "value": PriorityLevel(self.group.priority).to_str(),
            "dateCreated": gopa.date_added,
        }
