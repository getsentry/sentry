from datetime import timedelta

from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models import IncidentStatus, IncidentTrigger
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.testutils import BaseIncidentsTest, TestCase


class IncidentAttachmentInfoTest(TestCase, BaseIncidentsTest):
    def test_returns_correct_info(self):
        alert_rule = self.create_alert_rule()
        date_started = self.now
        incident = self.create_incident(
            self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=date_started,
        )
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        metric_value = 123
        data = incident_attachment_info(incident, metric_value, action)

        assert data["title"] == f"Resolved: {alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "123 events in the last 10 minutes\nFilter: level:error"
        assert data["ts"] == date_started
        assert data["title_link"] == "http://testserver/organizations/baz/alerts/1/"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_incident_trigger(self):
        alert_rule = self.create_alert_rule()
        now = self.now
        date_started = now - timedelta(minutes=5)
        event_date = now - timedelta(minutes=5)

        self.create_event(event_date)
        self.create_event(event_date)
        self.create_event(event_date)
        self.create_event(event_date)

        incident = self.create_incident(
            self.organization,
            title="Incident #2",
            projects=[self.project],
            alert_rule=alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=date_started,
            query="",
        )
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )

        incident_trigger = (
            IncidentTrigger.objects.filter(incident=incident).order_by("-date_modified").first()
        )
        incident_trigger.update(date_modified=now)

        # Test the trigger "firing"
        data = incident_attachment_info(incident, action=action, method="fire")
        assert data["title"] == "Critical: {}".format(
            alert_rule.name
        )  # Pulls from trigger, not incident
        assert data["status"] == "Critical"  # Should pull from the action/trigger.
        assert data["text"] == "4 events in the last 10 minutes\nFilter: level:error"
        assert data["ts"] == date_started
        assert data["title_link"] == "http://testserver/organizations/baz/alerts/1/"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

        # Test the trigger "resolving"
        data = incident_attachment_info(incident, action=action, method="resolve")
        assert data["title"] == f"Resolved: {alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "4 events in the last 10 minutes\nFilter: level:error"
        assert data["ts"] == date_started
        assert data["title_link"] == "http://testserver/organizations/baz/alerts/1/"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

        # No trigger passed, uses incident as fallback
        data = incident_attachment_info(incident, action=action)
        assert data["title"] == f"Resolved: {alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "4 events in the last 10 minutes\nFilter: level:error"
        assert data["ts"] == date_started
        assert data["title_link"] == "http://testserver/organizations/baz/alerts/1/"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )
