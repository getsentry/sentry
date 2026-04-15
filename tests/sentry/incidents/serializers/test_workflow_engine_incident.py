from typing import Any

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineDetailedIncidentSerializer,
    WorkflowEngineIncidentSerializer,
)
from sentry.incidents.models.incident import (
    IncidentActivityType,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentType,
)
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.snuba.models import SnubaQueryEventType
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
        self.expected["eventTypes"] = sorted(
            SnubaQueryEventType.EventType(et.type).name.lower()
            for et in SnubaQueryEventType.objects.filter(snuba_query=self.alert_rule.snuba_query)
        )
        self.expected["snooze"] = False
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

    @staticmethod
    def _sort_triggers(incident: dict[str, Any]) -> dict[str, Any]:
        """Sort triggers by label for order-independent comparison."""
        incident = dict(incident)
        incident["alertRule"] = dict(incident["alertRule"])
        incident["alertRule"]["triggers"] = sorted(
            incident["alertRule"]["triggers"], key=lambda t: t["label"]
        )
        return incident

    def test_simple(self) -> None:
        serialized_incident = serialize(
            self.group_open_period, self.user, WorkflowEngineIncidentSerializer()
        )
        assert self._sort_triggers(serialized_incident) == self._sort_triggers(
            self.incident_expected
        )

    def test_detailed(self) -> None:
        serialized_incident = serialize(
            self.group_open_period, self.user, WorkflowEngineDetailedIncidentSerializer()
        )
        self.incident_expected["discoverQuery"] = "(event.type:error) AND (level:error)"
        assert self._sort_triggers(serialized_incident) == self._sort_triggers(
            self.incident_expected
        )

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
        fake_alert_rule_id = get_fake_id_from_object_id(self.detector.id)
        fake_incident_id = get_fake_id_from_object_id(self.group_open_period.id)
        self.expected.update({"id": str(fake_alert_rule_id)})
        self.expected["triggers"][0].update(
            {
                "id": str(get_fake_id_from_object_id(self.critical_detector_trigger.id)),
                "alertRuleId": str(fake_alert_rule_id),
            }
        )
        self.expected["triggers"][1].update(
            {
                "alertRuleId": str(fake_alert_rule_id),
            }
        )
        self.expected["triggers"][0]["actions"][0].update(
            {
                "id": str(get_fake_id_from_object_id(self.critical_action.id)),
                "alertRuleTriggerId": str(
                    get_fake_id_from_object_id(self.critical_detector_trigger.id)
                ),
            }
        )

        self.incident_expected.update(
            {
                "id": str(fake_incident_id),
                "identifier": str(fake_incident_id),
            }
        )
        assert self._sort_triggers(serialized_incident) == self._sort_triggers(
            self.incident_expected
        )

    def test_with_activities(self) -> None:
        gopa = GroupOpenPeriodActivity.objects.create(
            date_added=self.group_open_period.date_added,
            group_open_period=self.group_open_period,
            type=OpenPeriodActivityType.OPENED,
            value=self.group.priority,
            event_id="a" * 32,
        )
        serialized_incident = serialize(
            self.group_open_period,
            self.user,
            WorkflowEngineIncidentSerializer(expand=["activities"]),
        )
        assert len(serialized_incident["activities"]) == 1
        assert serialized_incident["activities"][0] == {
            "id": str(gopa.id),
            "type": IncidentActivityType.STATUS_CHANGE.value,
            "value": str(IncidentStatus.CRITICAL.value),
            "previousValue": None,
            "dateCreated": gopa.date_added,
        }

    def test_with_activities_tracks_previous_value(self) -> None:
        GroupOpenPeriodActivity.objects.create(
            date_added=self.group_open_period.date_added,
            group_open_period=self.group_open_period,
            type=OpenPeriodActivityType.OPENED,
            value=self.group.priority,
        )
        gopa_status_change = GroupOpenPeriodActivity.objects.create(
            date_added=self.group_open_period.date_added,
            group_open_period=self.group_open_period,
            type=OpenPeriodActivityType.STATUS_CHANGE,
            value=PriorityLevel.MEDIUM,
        )
        serialized_incident = serialize(
            self.group_open_period,
            self.user,
            WorkflowEngineIncidentSerializer(expand=["activities"]),
        )
        activities = serialized_incident["activities"]
        assert len(activities) == 2
        assert activities[0]["value"] == str(IncidentStatus.CRITICAL.value)
        assert activities[0]["previousValue"] is None
        assert activities[1]["value"] == str(IncidentStatus.WARNING.value)
        assert activities[1]["previousValue"] == str(IncidentStatus.CRITICAL.value)
        assert activities[1]["id"] == str(gopa_status_change.id)

    def test_with_activities_closed_maps_to_closed_status(self) -> None:
        GroupOpenPeriodActivity.objects.create(
            date_added=self.group_open_period.date_added,
            group_open_period=self.group_open_period,
            type=OpenPeriodActivityType.OPENED,
            value=self.group.priority,
        )
        gopa_closed = GroupOpenPeriodActivity.objects.create(
            date_added=self.group_open_period.date_added,
            group_open_period=self.group_open_period,
            type=OpenPeriodActivityType.CLOSED,
            value=None,
        )
        serialized_incident = serialize(
            self.group_open_period,
            self.user,
            WorkflowEngineIncidentSerializer(expand=["activities"]),
        )
        activities = serialized_incident["activities"]
        assert len(activities) == 2
        assert activities[1]["id"] == str(gopa_closed.id)
        assert activities[1]["value"] == str(IncidentStatus.CLOSED.value)
        assert activities[1]["previousValue"] == str(IncidentStatus.CRITICAL.value)

    def test_with_activities_skips_null_value_non_closed(self) -> None:
        gopa_malformed = GroupOpenPeriodActivity.objects.create(
            date_added=self.group_open_period.date_added,
            group_open_period=self.group_open_period,
            type=OpenPeriodActivityType.STATUS_CHANGE,
            value=None,
        )
        serialized_incident = serialize(
            self.group_open_period,
            self.user,
            WorkflowEngineIncidentSerializer(expand=["activities"]),
        )
        activity_ids = [a["id"] for a in serialized_incident["activities"]]
        assert str(gopa_malformed.id) not in activity_ids
