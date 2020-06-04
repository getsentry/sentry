import sentry.integrations.slack.utils as util
from sentry.models import Integration, Organization
from sentry.snuba.models import QueryAggregations
from sentry.incidents.models import Incident, AlertRule, IncidentStatus, AlertRuleTrigger, TriggerStatus, AlertRuleTriggerAction, IncidentTrigger
from datetime import datetime
import pytz
import time
# integration = Integration.objects.get(id=1)
# incident = Incident.objects.get(id=16)

org = Organization.objects.create(name="chris' test org")
alert_rule = AlertRule.objects.all().first()
# alert_rule.include_all_projects = True
# alert_rule.name = "ALERT RULE NAME"
alert_rule.query = "event.type:error"
# alert_rule.time_window = 10
# alert_rule.aggregation = QueryAggregations.UNIQUE_USERS.value
# alert_rule.save()
#
alert_rule_trigger = AlertRuleTrigger.objects.all().first()
alert_rule_trigger2 = AlertRuleTrigger.objects.all().last()

# alert_rule_trigger2 = AlertRuleTrigger.objects.create(
#     alert_rule=alert_rule,
#     label="somelabelmeow",
#     threshold_type=0,
#     alert_threshold=100,
#     resolve_threshold=50,
# )
# alert_rule_trigger.threshold_type = 1
# alert_rule_trigger.save()

alert_rule_trigger_action =  AlertRuleTriggerAction.objects.filter(alert_rule_trigger=alert_rule_trigger).first()

incident = Incident.objects.create(
    organization=org,
    detection_uuid=None,
    status=IncidentStatus.CLOSED.value,
    type=2,
    title="a custom incident title",
    query="event.type:error",
    aggregation=0,
    date_started=datetime.utcnow().replace(tzinfo=pytz.utc),
    date_detected=datetime.utcnow().replace(tzinfo=pytz.utc),
    alert_rule=alert_rule,
)

incident2 = Incident.objects.create(
    organization=org,
    detection_uuid=None,
    status=IncidentStatus.CLOSED.value,
    type=2,
    title="a custom incident title",
    query="event.type:transaction",
    aggregation=0,
    date_started=datetime.utcnow().replace(tzinfo=pytz.utc),
    date_detected=datetime.utcnow().replace(tzinfo=pytz.utc),
    alert_rule=alert_rule,
)

incident3 = Incident.objects.create(
    organization=org,
    detection_uuid=None,
    status=IncidentStatus.CLOSED.value,
    type=2,
    title="incident3",
    query="user.email:cfuller@sentry.io",
    aggregation=0,
    date_started=datetime.utcnow().replace(tzinfo=pytz.utc),
    date_detected=datetime.utcnow().replace(tzinfo=pytz.utc),
    alert_rule=alert_rule,
)


incident_trigger = IncidentTrigger.objects.create(
    incident=incident,
    alert_rule_trigger=alert_rule_trigger,
    status=TriggerStatus.RESOLVED.value,
)


incident_trigger2 = IncidentTrigger.objects.create(
    incident=incident,
    alert_rule_trigger=alert_rule_trigger2,
    status=TriggerStatus.ACTIVE.value,
)


# print("incident_trigger:",incident_trigger)
# print("incident_trigger:",incident_trigger.date_modified)
# time.sleep(2)
# incident_trigger.status=0
# incident_trigger.save()
print("incident_trigger id:",incident_trigger.id)
print("incident_trigger2 id:",incident_trigger2.id)
print("alert_rule_trigger_action:",alert_rule_trigger_action)

util.send_incident_alert_notification(alert_rule_trigger_action, incident)

print("sleeping...")
time.sleep(2)
print("Updating trigger..",incident_trigger.date_modified)
incident_trigger.status=TriggerStatus.ACTIVE.value
incident_trigger.save();
incident_trigger.status=TriggerStatus.RESOLVED.value
incident_trigger.save();
print("Update complete.",incident_trigger.date_modified)

util.send_incident_alert_notification(alert_rule_trigger_action, incident)

# time.sleep(2)

# incident_trigger.status=0
# incident_trigger.save()
# print("incident_trigger:",incident_trigger.date_modified)

# execfile('../sentry/test_slack_alert.py')
