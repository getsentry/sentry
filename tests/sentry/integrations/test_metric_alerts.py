from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models import IncidentStatus, IncidentTrigger
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.snuba.models import QueryDatasets
from sentry.testutils import BaseIncidentsTest, SnubaTestCase, TestCase
from sentry.testutils.cases import SessionMetricsTestCase
from sentry.utils.dates import to_timestamp


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
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        metric_value = 123
        data = incident_attachment_info(incident, IncidentStatus.CLOSED, metric_value)

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
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )

        incident_trigger = (
            IncidentTrigger.objects.filter(incident=incident).order_by("-date_modified").first()
        )
        incident_trigger.update(date_modified=now)

        # Test the trigger "firing"
        data = incident_attachment_info(incident, IncidentStatus.CRITICAL)
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
        data = incident_attachment_info(incident, IncidentStatus.CLOSED)
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
        data = incident_attachment_info(incident, IncidentStatus.CLOSED)
        assert data["title"] == f"Resolved: {alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "4 events in the last 10 minutes\nFilter: level:error"
        assert data["ts"] == date_started
        assert data["title_link"] == "http://testserver/organizations/baz/alerts/1/"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )


@freeze_time("2021-10-18 13:00:00+00:00")
class IncidentAttachmentInfoTestForCrashRateAlerts(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.now = timezone.now().replace(minute=0, second=0, microsecond=0)
        self._5_min_ago = to_timestamp(self.now - timedelta(minutes=5))
        self.date_started = self.now - timedelta(minutes=120)

    def create_incident_and_related_objects(self, field="sessions"):
        self.alert_rule = self.create_alert_rule(
            query="",
            aggregate=f"percentage({field}_crashed, {field}) AS _crash_rate_alert_aggregate",
            dataset=QueryDatasets.SESSIONS,
            time_window=60,
        )
        self.incident = self.create_incident(
            self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=self.alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=self.now - timedelta(minutes=120),
        )
        trigger = self.create_alert_rule_trigger(self.alert_rule, CRITICAL_TRIGGER_LABEL, 95)
        self.action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=self.incident
        )
        for _ in range(2):
            self.store_session(self.build_session(status="exited", started=self._5_min_ago))

    def test_with_incident_trigger_sessions(self):
        self.create_incident_and_related_objects()
        data = incident_attachment_info(self.incident, IncidentStatus.CRITICAL, 92)

        assert data["title"] == f"Critical: {self.alert_rule.name}"
        assert data["status"] == "Critical"
        assert data["text"] == "92% sessions crash free rate in the last 60 minutes"
        assert data["ts"] == self.date_started
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_incident_trigger_sessions_resolve(self):
        self.create_incident_and_related_objects()
        data = incident_attachment_info(self.incident, IncidentStatus.CLOSED)
        assert data["title"] == f"Resolved: {self.alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "100.0% sessions crash free rate in the last 60 minutes"
        assert data["ts"] == self.date_started
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_incident_trigger_users(self):
        self.create_incident_and_related_objects(field="users")
        data = incident_attachment_info(self.incident, IncidentStatus.CRITICAL, 92)
        assert data["title"] == f"Critical: {self.alert_rule.name}"
        assert data["status"] == "Critical"
        assert data["text"] == "92% users crash free rate in the last 60 minutes"
        assert data["ts"] == self.date_started
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_incident_trigger_users_resolve(self):
        self.create_incident_and_related_objects(field="users")
        data = incident_attachment_info(self.incident, IncidentStatus.CLOSED)
        assert data["title"] == f"Resolved: {self.alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "100.0% users crash free rate in the last 60 minutes"
        assert data["ts"] == self.date_started
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_incident_where_no_sessions_exist(self):
        alert_rule = self.create_alert_rule(
            query="",
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            dataset=QueryDatasets.SESSIONS,
            time_window=60,
        )
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 95)
        incident = self.create_incident(
            self.organization,
            title="Incident #2",
            projects=[self.project],
            alert_rule=alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=self.now,
        )
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        data = incident_attachment_info(incident, IncidentStatus.CRITICAL)

        assert data["title"] == f"Critical: {alert_rule.name}"
        assert data["status"] == "Critical"
        assert data["text"] == "No sessions crash free rate in the last 60 minutes"


@freeze_time("2021-10-18 13:00:00+00:00")
class IncidentAttachmentInfoTestForMetricsCrashRateAlerts(
    IncidentAttachmentInfoTestForCrashRateAlerts, SessionMetricsTestCase
):
    def create_incident_and_related_objects(self, field="sessions"):
        self.alert_rule = self.create_alert_rule(
            query="",
            aggregate=f"percentage({field}_crashed, {field}) AS _crash_rate_alert_aggregate",
            dataset=QueryDatasets.METRICS,
            time_window=60,
        )
        self.incident = self.create_incident(
            self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=self.alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=self.now - timedelta(minutes=120),
        )
        trigger = self.create_alert_rule_trigger(self.alert_rule, CRITICAL_TRIGGER_LABEL, 95)
        self.action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=self.incident
        )
        for _ in range(2):
            self.store_session(self.build_session(status="exited", started=self._5_min_ago))
