from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineIncidentSerializer,
)
from sentry.incidents.models.incident import (
    IncidentStatus,
    IncidentStatusMethod,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_condition,
)
from sentry.workflow_engine.models import ActionGroupStatus, IncidentGroupOpenPeriod


@freeze_time("2024-12-11 03:21:34")
class TestDetectorSerializer(TestCase):
    def setUp(self) -> None:
        self.alert_rule = self.create_alert_rule()
        self.critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="critical"
        )
        self.critical_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.critical_trigger
        )
        self.warning_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="warning"
        )
        self.warning_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.warning_trigger
        )
        _, _, _, self.detector, _, _, _, _ = migrate_alert_rule(self.alert_rule)
        self.critical_detector_trigger, _ = migrate_metric_data_conditions(self.critical_trigger)
        self.warning_detector_trigger, _ = migrate_metric_data_conditions(self.warning_trigger)

        self.critical_action, _, _ = migrate_metric_action(self.critical_trigger_action)
        self.warning_action, _, _ = migrate_metric_action(self.warning_trigger_action)
        self.resolve_trigger_data_condition = migrate_resolve_threshold_data_condition(
            self.alert_rule
        )

        now = timezone.now()
        self.incident = self.create_incident(alert_rule=self.alert_rule, date_started=now)
        IncidentTrigger.objects.create(
            incident=self.incident,
            alert_rule_trigger=self.critical_trigger,
            status=TriggerStatus.ACTIVE.value,
        )
        # TODO make the incident go from warning / critical etc. and make Activity rows for that
        self.group.priority = PriorityLevel.HIGH
        self.group.save()
        ActionGroupStatus.objects.create(action=self.critical_action, group=self.group)
        self.group_open_period = GroupOpenPeriod.objects.create(
            group=self.group, project=self.detector.project, date_started=self.incident.date_started
        )
        self.incident_group_open_period = IncidentGroupOpenPeriod.objects.create(
            group_open_period=self.group_open_period, incident_id=self.incident.id
        )
        alert_rule_data = (
            {}
        )  # fill this out, might want to refactor tests to have a shared base class so I can grab this easily
        self.expected = {
            "id": str(self.incident_group_open_period.incident_id),
            "identifier": str(self.group_open_period.id),  # this is temporary and incorrect
            "organizationId": str(self.organization.id),
            "projects": [self.project.slug],
            "alertRule": alert_rule_data,
            "activities": None,  # TODO fill this out
            "status": IncidentStatus.CRITICAL.value,
            "statusMethod": IncidentStatusMethod.RULE_TRIGGERED.value,
            "type": IncidentType.ALERT_TRIGGERED.value,
            "title": self.group_open_period.group.title,
            "dateStarted": self.group_open_period.date_started,
            "dateDetected": self.group_open_period.date_started,
            "dateCreated": self.group_open_period.date_added,
            "dateClosed": self.group_open_period.date_ended,
        }

    def test_simple(self) -> None:
        serialized_incident = serialize(
            self.group_open_period, self.user, WorkflowEngineIncidentSerializer()
        )
        assert serialized_incident == self.expected
