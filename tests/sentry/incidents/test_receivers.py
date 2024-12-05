from datetime import datetime, timezone

from sentry.incidents.models.alert_rule import AlertRuleTrigger
from sentry.incidents.models.incident import (
    Incident,
    IncidentStatus,
    IncidentTrigger,
    TriggerStatus,
)
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase


class PreSaveIncidentTriggerTest(TestCase):
    def test_update_date_modified(self):
        org = Organization.objects.create(name="chris' test org")
        alert_rule = self.create_alert_rule()
        trigger = AlertRuleTrigger.objects.create(
            alert_rule=alert_rule,
            label="warning",
            threshold_type=0,
            alert_threshold=100,
            resolve_threshold=50,
        )
        incident = Incident.objects.create(
            organization=org,
            detection_uuid=None,
            status=IncidentStatus.WARNING.value,
            type=2,
            title="a custom incident title",
            date_started=datetime.now(timezone.utc),
            date_detected=datetime.now(timezone.utc),
            alert_rule=alert_rule,
        )
        incident_trigger = IncidentTrigger.objects.create(
            incident=incident, alert_rule_trigger=trigger, status=TriggerStatus.ACTIVE.value
        )
        date_modified = incident_trigger.date_modified
        incident_trigger.status = TriggerStatus.RESOLVED.value
        incident_trigger.save()
        incident_trigger.refresh_from_db()
        assert date_modified < incident_trigger.date_modified
