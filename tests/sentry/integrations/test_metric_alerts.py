from __future__ import absolute_import

import datetime
from django.utils import timezone

from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.testutils import TestCase


class IncidentAttachmentInfoTest(TestCase):
    def test_correct_info_returned(self):
        alert_rule = self.create_alert_rule()
        date_started = datetime.datetime(2020, 8, 17, 18, 13, 55, 133221, tzinfo=timezone.utc)
        incident = self.create_incident(
            self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=alert_rule,
            status=2,
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
