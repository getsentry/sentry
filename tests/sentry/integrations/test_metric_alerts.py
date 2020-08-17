from __future__ import absolute_import

from datetime import timedelta


from sentry.testutils import TestCase, BaseIncidentsTest
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.incidents.models import IncidentStatus, IncidentTrigger


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
        metric_value = 123
        data = incident_attachment_info(incident, metric_value)

        assert data["title"] == "Resolved: {}".format(alert_rule.name)
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

        self.create_alert_rule_trigger_action(triggered_for_incident=incident)

        incident_trigger = (
            IncidentTrigger.objects.filter(incident=incident).order_by("-date_modified").first()
        )
        incident_trigger.update(date_modified=now)

        data = incident_attachment_info(incident)

        assert data["title"] == "Resolved: {}".format(alert_rule.name)
        assert data["status"] == "Resolved"
        assert data["text"] == "4 events in the last 10 minutes\nFilter: level:error"
        assert data["ts"] == date_started
        assert data["title_link"] == "http://testserver/organizations/baz/alerts/1/"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )
